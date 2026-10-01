import { NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import { SESSION_COOKIE_NAME, signSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    const rateLimitKey = getClientIdentifier(request, 'auth.login');
    const rateLimit = checkRateLimit(rateLimitKey, { windowMs: 60_000, maxRequests: 8 });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again in a minute.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)) } }
      );
    }

    const body = await request.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const user = await db.queryOne<{
      id: string;
      email: string;
      password_hash: string;
      role: string;
      name: string | null;
    }>(
      'SELECT id, email, password_hash, role, name FROM users WHERE email = $1 LIMIT 1;',
      [email]
    );

    if (!user) {
      await recordAuditEvent({ eventType: 'auth.login_failed', details: { reason: 'unknown_account' } });
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const validPassword = await compare(password, user.password_hash);
    if (!validPassword) {
      await recordAuditEvent({ actorUserId: user.id, eventType: 'auth.login_failed', entityType: 'user', entityId: user.id, details: { reason: 'invalid_password' } });
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const role = user.role === 'superadmin' ? 'superadmin' : user.role === 'admin' ? 'admin' : 'reader';
    const token = await signSession({
      userId: user.id,
      email: user.email,
      role,
    });

    await recordAuditEvent({ actorUserId: user.id, eventType: 'auth.login_succeeded', entityType: 'user', entityId: user.id, details: { role } });

    const response = NextResponse.json({
      ok: true,
      user: {
        userId: user.id,
        email: user.email,
        name: user.name,
        role,
      },
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Unable to sign in.' }, { status: 500 });
  }
}
