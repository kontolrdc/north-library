import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';

export async function GET() {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const books = await db.query(
    `
      SELECT s.id, s.title, s.slug, s.author, s.summary, s.price, sb.saved_at
      FROM saved_books sb
      INNER JOIN stories s ON s.id = sb.story_id
      WHERE sb.user_id = $1
        AND s.is_published = true
      ORDER BY sb.saved_at DESC;
    `,
    [session.userId]
  );

  return NextResponse.json({ books });
}

export async function POST(request: Request) {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const storyId = String(body.storyId ?? '').trim();

    if (!storyId) {
      return NextResponse.json({ error: 'Story id is required.' }, { status: 400 });
    }

    const story = await db.queryOne<{ id: string }>(
      `
        SELECT s.id
        FROM stories s
        WHERE (s.id::text = $1 OR s.slug = $1)
          AND s.is_published = true
          AND EXISTS (
            SELECT 1
            FROM user_entitlements ue
            WHERE ue.user_id = $2
              AND ue.story_id = s.id
          )
        LIMIT 1;
      `,
      [storyId, session.userId]
    );

    if (!story) {
      return NextResponse.json({ error: 'Purchase access to this story before saving it.' }, { status: 403 });
    }

    await db.query(
      `
        INSERT INTO saved_books (user_id, story_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id, story_id) DO NOTHING;
      `,
      [session.userId, story.id]
    );

    await recordAuditEvent({ actorUserId: session.userId, eventType: 'library.book_saved', entityType: 'story', entityId: story.id });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Save book error:', error);
    return NextResponse.json({ error: 'Unable to save this book.' }, { status: 500 });
  }
}