import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';

async function resolveStoryId(value: string) {
  const story = await db.queryOne<{ id: string }>(
    'SELECT id FROM stories WHERE id::text = $1 OR slug = $1 LIMIT 1;',
    [value]
  );
  return story?.id ?? null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ currentPage: 0 }, { status: 401 });

  const { id } = await params;
  const storyId = await resolveStoryId(id);
  if (!storyId) return NextResponse.json({ error: 'Story not found.' }, { status: 404 });

  const progress = await db.queryOne<{ current_page: number }>(
    'SELECT current_page FROM reading_progress WHERE user_id = $1 AND story_id = $2 LIMIT 1;',
    [session.userId, storyId]
  );

  return NextResponse.json({ currentPage: progress?.current_page ?? 0 });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const storyId = await resolveStoryId(id);
    const body = await request.json();
    const currentPage = Number(body.currentPage);

    if (!storyId || !Number.isInteger(currentPage) || currentPage < 0) {
      return NextResponse.json({ error: 'A valid story and page are required.' }, { status: 400 });
    }

    await db.query(
      `
        INSERT INTO reading_progress (user_id, story_id, current_page, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id, story_id)
        DO UPDATE SET current_page = GREATEST(reading_progress.current_page, EXCLUDED.current_page), updated_at = NOW();
      `,
      [session.userId, storyId, currentPage]
    );

    await recordAuditEvent({ actorUserId: session.userId, eventType: 'reader.progress_updated', entityType: 'story', entityId: storyId, details: { currentPage } });

    return NextResponse.json({ ok: true, currentPage });
  } catch (error) {
    console.error('Reading progress error:', error);
    return NextResponse.json({ error: 'Unable to save reading progress.' }, { status: 500 });
  }
}