import crypto from 'node:crypto';
import { hash } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = String(body.token ?? '').trim();
    const password = String(body.password ?? '');

    if (!token || password.length < 8) {
      return NextResponse.json({ error: 'A valid reset link and password of at least 8 characters are required.' }, { status: 400 });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const passwordHash = await hash(password, 12);
    const reset = await db.withTransaction(async (client) => {
      const tokenResult = await client.query<{ id: string; user_id: string }>(
        `SELECT id, user_id FROM password_reset_tokens
         WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
         FOR UPDATE;`,
        [tokenHash]
      );
      const resetToken = tokenResult.rows[0];
      if (!resetToken) return null;

      await client.query('UPDATE users SET password_hash = $1 WHERE id = $2;', [passwordHash, resetToken.user_id]);
      await client.query(
        'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL;',
        [resetToken.user_id]
      );
      return resetToken.user_id;
    });

    if (!reset) {
      return NextResponse.json({ error: 'This reset link is invalid or has expired. Request a new one.' }, { status: 400 });
    }

    await recordAuditEvent({ actorUserId: reset, eventType: 'auth.password_reset_completed', entityType: 'user', entityId: reset });

    return NextResponse.json({ ok: true, message: 'Password updated. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Unable to reset the password.' }, { status: 500 });
  }
}