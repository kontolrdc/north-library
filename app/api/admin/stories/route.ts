import { NextResponse } from 'next/server';
import { getServerSession, hasAdminAccess } from '@/lib/auth';
import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';

export async function GET() {
  const session = await getServerSession();

  if (!hasAdminAccess(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const stories = await db.query<{
    id: string;
    title: string;
    slug: string;
    category: string | null;
    description: string | null;
    summary: string | null;
    author: string | null;
    price: string;
    page_count: number;
    free_page_count: number;
    is_published: boolean;
  }>(
    `
      SELECT s.id, s.title, s.slug, c.name AS category, s.description, s.summary, s.author, s.price, s.page_count, s.free_page_count, s.is_published
      FROM stories s
      LEFT JOIN categories c ON c.id = s.category_id
      ORDER BY s.created_at DESC;
    `
  );

  return NextResponse.json({ stories: stories.map((story) => ({ ...story, price: Number(story.price) })) });
}

export async function POST(request: Request) {
  const session = await getServerSession();

  if (!hasAdminAccess(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const title = String(body.title ?? '').trim();
    const generatedSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const slugValue = body.slug ?? generatedSlug;
    const slug = String(slugValue || '').trim();
    const description = String(body.description ?? '').trim();
    const summary = String(body.summary ?? '').trim();
    const author = String(body.author ?? '').trim();
    const price = Number(body.price ?? 1);
    const categoryName = String(body.category ?? '').trim();
    const isPublished = Boolean(body.isPublished ?? true);

    if (!title || !slug) {
      return NextResponse.json({ error: 'Title is required.' }, { status: 400 });
    }

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
        INSERT INTO stories (title, slug, category_id, description, summary, author, price, is_published)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id;
      `,
      [title, slug, categoryId, description || null, summary || null, author || null, price, isPublished]
    );

    if (story) {
      await recordAuditEvent({ actorUserId: session?.userId, eventType: 'story.created', entityType: 'story', entityId: story.id, details: { slug, isPublished, price } });
    }

    return NextResponse.json({ ok: true, storyId: story?.id }, { status: 201 });
  } catch (error) {
    console.error('Admin create story error:', error);
    return NextResponse.json({ error: 'Unable to create story.' }, { status: 500 });
  }
}