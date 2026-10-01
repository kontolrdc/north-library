import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';

const MAX_AVATAR_LENGTH = 2_000_000;
const avatarPattern = /^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i;

export async function GET() {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await db.queryOne<{ id: string; name: string | null; email: string; avatar_url: string | null }>(
    'SELECT id, name, email, avatar_url FROM users WHERE id = $1 LIMIT 1;',
    [session.userId]
  );

  if (!user) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }

  return NextResponse.json({ user: { ...user, avatarUrl: user.avatar_url } });
}

export async function PATCH(request: Request) {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const name = body.name === undefined ? undefined : String(body.name ?? '').trim();
    const avatarUrl = body.avatarUrl === undefined ? undefined : String(body.avatarUrl ?? '').trim();

    if (avatarUrl !== undefined && avatarUrl && (avatarUrl.length > MAX_AVATAR_LENGTH || !avatarPattern.test(avatarUrl))) {
      return NextResponse.json({ error: 'Use a PNG, JPEG, or WebP image smaller than 1.5 MB.' }, { status: 400 });
    }

    const user = await db.queryOne<{ id: string; name: string | null; email: string; avatar_url: string | null }>(
      `
        UPDATE users
        SET name = COALESCE($1, name),
            avatar_url = COALESCE($2, avatar_url)
        WHERE id = $3
        RETURNING id, name, email, avatar_url;
      `,
      [name ?? null, avatarUrl === undefined ? null : avatarUrl || null, session.userId]
    );

    await recordAuditEvent({ actorUserId: session.userId, eventType: 'account.profile_updated', entityType: 'user', entityId: session.userId, details: { nameChanged: name !== undefined, avatarChanged: avatarUrl !== undefined } });

    return NextResponse.json({ user: user ? { ...user, avatarUrl: user.avatar_url } : null });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json({ error: 'Unable to update profile.' }, { status: 500 });
  }
}