import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getServerSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { initializePaystack } from '@/lib/paystack';
import { BUSINESS_RULES, FREE_READER_PAGES } from '@/lib/config';
import { recordAuditEvent } from '@/lib/audit';

export async function POST(request: Request) {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const bookId = String(body.bookId ?? '').trim();
    const scope = body.scope === 'story' ? 'story' : 'page';
    const pageIndex = Number(body.pageIndex ?? 0);

    if (!bookId || !Number.isInteger(pageIndex) || pageIndex < 0) {
      return NextResponse.json({ error: 'A valid story and page are required.' }, { status: 400 });
    }

    if (scope === 'page' && pageIndex < FREE_READER_PAGES) {
      return NextResponse.json({ error: 'This page is free.' }, { status: 400 });
    }

    const story = await db.queryOne<{ id: string; slug: string; price: string; page_count: number; free_page_count: number }>(
      'SELECT id, slug, price, page_count, free_page_count FROM stories WHERE id::text = $1 OR slug = $1 LIMIT 1;',
      [bookId]
    );

    if (!story) {
      return NextResponse.json({ error: 'Story not found.' }, { status: 404 });
    }

    if (scope === 'page' && pageIndex >= story.page_count) {
      return NextResponse.json({ error: 'Page not found.' }, { status: 404 });
    }
    if (scope === 'page' && pageIndex < story.free_page_count) {
      return NextResponse.json({ error: 'This page is free.' }, { status: 400 });
    }

    const amount = scope === 'story' ? Number(story.price) : BUSINESS_RULES.pagePrice;
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'A valid amount is required.' }, { status: 400 });
    }

    const reference = `nhl_${crypto.randomUUID()}`;
    await db.query(
      `
        INSERT INTO payments (user_id, story_id, book_id, page_index, scope, reference, amount, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending');
      `,
      [session.userId, story.id, story.slug, scope === 'story' ? null : pageIndex, scope, reference, amount]
    );

    await recordAuditEvent({ actorUserId: session.userId, eventType: 'payment.initialized', entityType: 'payment', entityId: reference, details: { storyId: story.id, pageIndex: scope === 'story' ? null : pageIndex, scope, amount, currency: 'GHS' } });

    let result: Awaited<ReturnType<typeof initializePaystack>>;
    try {
      result = await initializePaystack({
        email: session.email,
        amount,
        reference,
        callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/books/${story.slug}?payment_reference=${encodeURIComponent(reference)}`,
      });
    } catch (error) {
      await db.query("UPDATE payments SET status = 'initialization_failed' WHERE reference = $1 AND status = 'pending';", [reference]);
      await recordAuditEvent({ actorUserId: session.userId, eventType: 'payment.initialization_failed', entityType: 'payment', entityId: reference, details: { storyId: story.id, amount, currency: 'GHS' } });
      throw error;
    }

    return NextResponse.json({
      ok: true,
      authorizationUrl: result.authorizationUrl,
      reference: result.reference,
    });
  } catch (error) {
    console.error('Payment initialization error:', error);
    return NextResponse.json({ error: 'Unable to initialize payment.' }, { status: 500 });
  }
}
