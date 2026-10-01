import { NextResponse } from 'next/server';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { WorkerMessageHandler } from 'pdfjs-dist/legacy/build/pdf.worker.mjs';
import { getServerSession, hasAdminAccess } from '@/lib/auth';
import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';

export const runtime = 'nodejs';

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_PDF_PAGES = 300;
Object.assign(globalThis, { pdfjsWorker: { WorkerMessageHandler } });

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!hasAdminAccess(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let loadingTask: ReturnType<typeof getDocument> | undefined;

  try {
    const form = await request.formData();
    const file = form.get('file');
    const title = String(form.get('title') ?? '').trim();
    const description = String(form.get('description') ?? '').trim();
    const summary = String(form.get('summary') ?? '').trim();
    const introduction = String(form.get('introduction') ?? '').trim();
    const author = String(form.get('author') ?? '').trim();
    const categoryName = String(form.get('category') ?? 'Literature').trim();

    if (!(file instanceof File) || file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'Choose a PDF smaller than 4 MB.' }, { status: 400 });
    }
    if (file.type !== 'application/pdf' || !title || !introduction) {
      return NextResponse.json({ error: 'A PDF, title, and free introduction are required.' }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') {
      return NextResponse.json({ error: 'The uploaded file is not a valid PDF.' }, { status: 400 });
    }

    loadingTask = getDocument({ data: bytes });
    const pdfDocument = await loadingTask.promise;
    if (pdfDocument.numPages > MAX_PDF_PAGES) {
      return NextResponse.json({ error: `PDFs are limited to ${MAX_PDF_PAGES} pages.` }, { status: 400 });
    }

    const extractedPages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const text = await page.getTextContent();
      const pageText = text.items
        .filter((item): item is typeof item & { str: string } => 'str' in item)
        .map((item) => `${item.str.trim()}${'hasEOL' in item && item.hasEOL ? '\n' : ' '}`)
        .join('')
        .replace(/[ \t]+\n/g, '\n')
        .trim();
      extractedPages.push(pageText);
    }

    const firstChapterIndex = extractedPages.findIndex((page) => /(?:^|\n)CHAPTER\s+(?:I|1)\b/i.test(page));
    const readingPages = firstChapterIndex > 0 ? extractedPages.slice(firstChapterIndex) : extractedPages;
    if (!readingPages.some((page) => page.trim())) {
      return NextResponse.json({ error: 'This PDF has no extractable text. Scanned image-only PDFs need OCR before upload.' }, { status: 422 });
    }

    const generatedSlug = title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const slug = `${generatedSlug}-${crypto.randomUUID().slice(0, 8)}`;
    const tableOfContents = readingPages
      .flatMap((page) => [...page.matchAll(/(?:^|\n)(CHAPTER\s+(?:[IVXLCDM]+|\d+))\s*\n([^\n]+)/gi)]
        .map((match) => `${match[1]}: ${match[2].trim()}`))
      .filter((heading, index, all) => all.indexOf(heading) === index)
      .slice(0, 80);

    const pageRows = [
      {
        pageIndex: 0,
        content: tableOfContents.length
          ? `Table of contents\n${tableOfContents.join('\n')}`
          : `Table of contents\n${title}`,
      },
      { pageIndex: 1, content: introduction },
      ...readingPages.map((content, index) => ({ pageIndex: index + 2, content })),
    ];

    const story = await db.withTransaction(async (client) => {
      const categorySlug = categoryName.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const categoryResult = await client.query<{ id: string }>(
        `INSERT INTO categories (name, slug) VALUES ($1, $2)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id;`,
        [categoryName, categorySlug]
      );
      const created = await client.query<{ id: string; slug: string }>(
        `INSERT INTO stories (title, slug, category_id, description, summary, author, price, page_count, free_page_count, is_published)
         VALUES ($1, $2, $3, $4, $5, $6, 1, $7, 2, true) RETURNING id, slug;`,
        [title, slug, categoryResult.rows[0].id, description || null, summary || null, author || null, pageRows.length]
      );

      for (const row of pageRows) {
        await client.query(
          'INSERT INTO story_pages (story_id, page_index, content_text) VALUES ($1, $2, $3);',
          [created.rows[0].id, row.pageIndex, row.content]
        );
      }

      return created.rows[0];
    });

    await recordAuditEvent({ actorUserId: session?.userId, eventType: 'story.pdf_uploaded', entityType: 'story', entityId: story.id, details: { pageCount: pageRows.length } });

    return NextResponse.json({ ok: true, story, pageCount: pageRows.length, freePageCount: 2 }, { status: 201 });
  } catch (error) {
    console.error('PDF story upload error:', error);
    return NextResponse.json({ error: 'Unable to process this PDF. Confirm it contains extractable text and try again.' }, { status: 500 });
  } finally {
    await loadingTask?.destroy();
  }
}