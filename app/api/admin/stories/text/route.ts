import { NextResponse } from 'next/server';
import { getServerSession, hasAdminAccess } from '@/lib/auth';
import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';

const PAGE_SEPARATOR = /\n\s*---PAGE---\s*\n/i;
const MAX_TEXT_LENGTH = 1_000_000;
const MAX_STORY_PAGES = 200;

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!hasAdminAccess(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const title = String(body.title ?? '').trim();
    const category = String(body.category ?? 'Community').trim();
    const author = String(body.author ?? '').trim();
    const description = String(body.description ?? '').trim();
    const summary = String(body.summary ?? '').trim();
    const introduction = String(body.introduction ?? '').trim();
    const pagesText = String(body.paidPages ?? '').trim();
    const isPublished = body.isPublished !== false;

    if (!title || !introduction || title.length > 240 || pagesText.length > MAX_TEXT_LENGTH) {
      return NextResponse.json({ error: 'A title and introduction are required; story text must be under 1 MB.' }, { status: 400 });
    }

    const paidPages = pagesText ? pagesText.split(PAGE_SEPARATOR).map((page) => page.trim()).filter(Boolean) : [];
    if (paidPages.length > MAX_STORY_PAGES) {
      return NextResponse.json({ error: `Stories are limited to ${MAX_STORY_PAGES} paid pages.` }, { status: 400 });
    }

    const slugBase = title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const slug = `${slugBase}-${crypto.randomUUID().slice(0, 8)}`;
    const headings = paidPages.map((page, index) => page.split(/\r?\n/, 1)[0]?.trim() || `Page ${index + 1}`);
    const toc = [`Table of contents`, `Introduction`, ...headings.map((heading, index) => `${index + 1}. ${heading}`)].join('\n');
    const pageRows = [toc, introduction, ...paidPages];

    const story = await db.withTransaction(async (client) => {
      const categorySlug = category.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const categoryResult = await client.query<{ id: string }>(
        `INSERT INTO categories (name, slug) VALUES ($1, $2)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id;`,
        [category, categorySlug]
      );
      const created = await client.query<{ id: string; slug: string }>(
        `INSERT INTO stories (title, slug, category_id, description, summary, author, price, page_count, free_page_count, is_published)
         VALUES ($1, $2, $3, $4, $5, $6, 1, $7, 2, $8)
         RETURNING id, slug;`,
        [title, slug, categoryResult.rows[0].id, description || null, summary || null, author || null, pageRows.length, isPublished]
      );

      for (const [pageIndex, content] of pageRows.entries()) {
        await client.query(
          'INSERT INTO story_pages (story_id, page_index, content_text) VALUES ($1, $2, $3);',
          [created.rows[0].id, pageIndex, content]
        );
      }

      return created.rows[0];
    });

    await recordAuditEvent({ actorUserId: session?.userId, eventType: 'story.text_created', entityType: 'story', entityId: story.id, details: { pageCount: pageRows.length, isPublished } });
    return NextResponse.json({ ok: true, story, pageCount: pageRows.length }, { status: 201 });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      return NextResponse.json({ error: 'A story with these details already exists.' }, { status: 409 });
    }
    console.error('Admin text story error:', error);
    return NextResponse.json({ error: 'Unable to create story.' }, { status: 500 });
  }
}
