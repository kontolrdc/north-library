import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';
import { sendPasswordResetEmail } from '@/lib/email';

const genericResponse = {
  ok: true,
  message: 'If an account exists for that email, password reset instructions will be sent.',
};

export async function POST(request: Request) {
  try {
    const rateLimitKey = getClientIdentifier(request, 'auth.forgot-password');
    const rateLimit = checkRateLimit(rateLimitKey, { windowMs: 60_000, maxRequests: 5 });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many password reset attempts. Please try again in a minute.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)) } }
      );
    }

    const body = await request.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }

    const user = await db.queryOne<{ id: string; email: string }>(
      'SELECT id, email FROM users WHERE email = $1 LIMIT 1;',
      [email]
    );

    if (!user) return NextResponse.json(genericResponse);

    await recordAuditEvent({ actorUserId: user.id, eventType: 'auth.password_reset_requested', entityType: 'user', entityId: user.id });

    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await db.withTransaction(async (client) => {
      await client.query(
        'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL;',
        [user.id]
      );
      await client.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '1 hour');`,
        [user.id, tokenHash]
      );
    });

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin}/auth/login/forget-password?token=${encodeURIComponent(token)}`;
    const emailResult = await sendPasswordResetEmail({
      to: user.email,
      resetUrl,
    });

    if (emailResult.ok) {
      return NextResponse.json(genericResponse);
    }

    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json({ ...genericResponse, developmentResetUrl: resetUrl });
    }

    console.error('Password reset requested, but RESEND_API_KEY and AUTH_FROM_EMAIL are not configured.');
    return NextResponse.json(genericResponse);
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Unable to process the reset request.' }, { status: 500 });
  }
}