import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, getServerSession } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/audit';

export async function POST() {
  const session = await getServerSession();
  if (session) {
    await recordAuditEvent({ actorUserId: session.userId, eventType: 'auth.logout', entityType: 'user', entityId: session.userId });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    expires: new Date(0),
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}
