import { NextResponse } from 'next/server';
import { getServerSession, hasAdminAccess } from '@/lib/auth';
import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();

  if (!hasAdminAccess(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const story = await db.queryOne<{ id: string; title: string; slug: string; category: string | null; description: string | null; summary: string | null; author: string | null; price: string; page_count: number; free_page_count: number; is_published: boolean }>(
    `
      SELECT s.id, s.title, s.slug, c.name AS category, s.description, s.summary, s.author, s.price, s.page_count, s.free_page_count, s.is_published
      FROM stories s
      LEFT JOIN categories c ON c.id = s.category_id
      WHERE s.id::text = $1 OR s.slug = $1
      LIMIT 1;
    `,
    [id]
  );

  if (!story) {
    return NextResponse.json({ error: 'Story not found.' }, { status: 404 });
  }

  return NextResponse.json({ story: { ...story, price: Number(story.price) } });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();

  if (!hasAdminAccess(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const title = String(body.title ?? '').trim();
    const description = body.description !== undefined ? String(body.description ?? '').trim() : undefined;
    const summary = body.summary !== undefined ? String(body.summary ?? '').trim() : undefined;
    const author = body.author !== undefined ? String(body.author ?? '').trim() : undefined;
    const price = body.price !== undefined ? Number(body.price) : undefined;
    const categoryName = body.category !== undefined ? String(body.category ?? '').trim() : undefined;
    const isPublished = body.isPublished !== undefined ? Boolean(body.isPublished) : undefined;

    let categoryId: string | null = null;
    if (categoryName) {
      const category = await db.queryOne<{ id: string }>(
        `INSERT INTO categories (name, slug)
         VALUES ($1, $2)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
         RETURNING id;`,
        [categoryName, categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')]
      );
      categoryId = category?.id ?? null;
    }

    const story = await db.queryOne<{ id: string }>(
      `
        UPDATE stories
        SET title = COALESCE($1, title),
            description = COALESCE($2, description),
            summary = COALESCE($3, summary),
            author = COALESCE($4, author),
            price = COALESCE($5::numeric, price),
            category_id = COALESCE($6::uuid, category_id),
            is_published = COALESCE($7::boolean, is_published)
        WHERE id::text = $8 OR slug = $8
        RETURNING id;
      `,
      [title || null, description ?? null, summary ?? null, author ?? null, price ?? null, categoryId, isPublished ?? null, id]
    );

    if (!story) {
      return NextResponse.json({ error: 'Story not found.' }, { status: 404 });
    }

    await recordAuditEvent({ actorUserId: session?.userId, eventType: 'story.updated', entityType: 'story', entityId: story.id });

    return NextResponse.json({ ok: true, storyId: story.id });
  } catch (error) {
    console.error('Admin update story error:', error);
    return NextResponse.json({ error: 'Unable to update story.' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();

  if (!hasAdminAccess(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const result = await db.query(
    'DELETE FROM stories WHERE id::text = $1 OR slug = $1 RETURNING id;',
    [id]
  );

  if (!result.length) {
    return NextResponse.json({ error: 'Story not found.' }, { status: 404 });
  }

  await recordAuditEvent({ actorUserId: session?.userId, eventType: 'story.deleted', entityType: 'story', entityId: String(result[0].id) });

  return NextResponse.json({ ok: true });
}