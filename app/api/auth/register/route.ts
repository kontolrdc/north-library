import { hash } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';
import { sendWelcomeEmail } from '@/lib/email';
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    const rateLimitKey = getClientIdentifier(request, 'auth.register');
    const rateLimit = checkRateLimit(rateLimitKey, { windowMs: 60_000, maxRequests: 5 });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again in a minute.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)) } }
      );
    }

    if (!request.headers.get('content-type')?.includes('application/json')) {
      return NextResponse.json({ error: 'Registration requires a JSON POST request.' }, { status: 415 });
    }

    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (contentLength > 10_000) {
      return NextResponse.json({ error: 'Registration request is too large.' }, { status: 413 });
    }

    const body = await request.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    const name = String(body.name ?? '').trim();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long.' }, { status: 400 });
    }

    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }

    const existing = await db.queryOne<{ id: string }>(
      'SELECT id FROM users WHERE email = $1 LIMIT 1;',
      [email]
    );

    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }

    const passwordHash = await hash(password, 12);
    const user = await db.queryOne<{ id: string; email: string; role: string }>(
      `
        INSERT INTO users (email, password_hash, role, name)
        VALUES ($1, $2, 'reader', $3)
        RETURNING id, email, role;
      `,
      [email, passwordHash, name || null]
    );

    if (!user) {
      return NextResponse.json({ error: 'Unable to create the account.' }, { status: 500 });
    }

    await recordAuditEvent({ actorUserId: user.id, eventType: 'auth.account_registered', entityType: 'user', entityId: user.id });

    const emailResult = await sendWelcomeEmail({
      to: user.email,
      name: name || 'reader',
    });

    if (!emailResult.ok) {
      console.warn('Welcome email not sent:', emailResult.reason);
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    }, { status: 201 });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }
    console.error('Register error:', error);
    return NextResponse.json({ error: 'Unable to create the account.' }, { status: 500 });
  }
}
