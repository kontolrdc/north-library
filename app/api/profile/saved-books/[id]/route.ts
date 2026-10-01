import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const result = await db.query(
    'DELETE FROM saved_books WHERE user_id = $1 AND story_id = $2 RETURNING id;',
    [session.userId, id]
  );

  if (!result.length) {
    return NextResponse.json({ error: 'Saved book not found.' }, { status: 404 });
  }

  await recordAuditEvent({ actorUserId: session.userId, eventType: 'library.book_unsaved', entityType: 'story', entityId: id });

  return NextResponse.json({ ok: true });
}