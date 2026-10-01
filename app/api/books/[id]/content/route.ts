import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { BUSINESS_RULES, DEFAULT_READER_PAGES } from '@/lib/config';
import { textToReaderHtml } from '@/lib/reader-content';
import { recordAuditEvent } from '@/lib/audit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookId } = await params;
    const pageIndex = Number.parseInt(request.nextUrl.searchParams.get('page') ?? '0', 10);

    const story = await db.queryOne<{ id: string; slug: string; page_count: number; free_page_count: number }>(
      'SELECT id, slug, page_count, free_page_count FROM stories WHERE (id::text = $1 OR slug = $1) AND is_published = true LIMIT 1;',
      [bookId]
    );

    if (!story) {
      return NextResponse.json({ error: 'Story not found.' }, { status: 404 });
    }

    if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= story.page_count) {
      return NextResponse.json({ error: 'Page not found.' }, { status: 404 });
    }

    const session = await getServerSession();
    const isFree = pageIndex < story.free_page_count;
    if (isFree) {
      const storedPage = await db.queryOne<{ content_text: string }>(
        'SELECT content_text FROM story_pages WHERE story_id = $1 AND page_index = $2;',
        [story.id, pageIndex]
      );

      await recordAuditEvent({ actorUserId: session?.userId, eventType: 'reader.free_page_opened', entityType: 'story', entityId: story.id, details: { pageIndex } });

      return NextResponse.json({
        locked: false,
        isFree: true,
        pageIndex,
        pageCount: story.page_count,
        content: storedPage ? textToReaderHtml(storedPage.content_text) : DEFAULT_READER_PAGES[pageIndex] ?? '',
      });
    }

    if (!session) {
      await recordAuditEvent({ eventType: 'reader.paid_page_auth_required', entityType: 'story', entityId: story.id, details: { pageIndex } });
      return NextResponse.json(
        { locked: true, reason: 'UNAUTHENTICATED', price: BUSINESS_RULES.pagePrice, pageIndex, pageCount: story.page_count },
        { status: 401 }
      );
    }

    const hasAccess = await db.getEntitlement(session.userId, story.slug, pageIndex);
    if (!hasAccess) {
      await recordAuditEvent({ actorUserId: session.userId, eventType: 'reader.paid_page_denied', entityType: 'story', entityId: story.id, details: { pageIndex } });
      return NextResponse.json(
        { locked: true, reason: 'PAYMENT_REQUIRED', price: BUSINESS_RULES.pagePrice, pageIndex, pageCount: story.page_count },
        { status: 403 }
      );
    }

    const storedPage = await db.queryOne<{ content_text: string }>(
      'SELECT content_text FROM story_pages WHERE story_id = $1 AND page_index = $2;',
      [story.id, pageIndex]
    );

    await recordAuditEvent({ actorUserId: session.userId, eventType: 'reader.paid_page_opened', entityType: 'story', entityId: story.id, details: { pageIndex } });

    return NextResponse.json({
      locked: false,
      isFree: false,
      pageIndex,
      pageCount: story.page_count,
      content: storedPage ? textToReaderHtml(storedPage.content_text) : DEFAULT_READER_PAGES[pageIndex] ?? '',
    });
  } catch (error) {
    console.error('Reader content error:', error);
    return NextResponse.json({ error: 'Unable to load this page.' }, { status: 500 });
  }
}