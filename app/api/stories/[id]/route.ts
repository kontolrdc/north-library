import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const story = await db.queryOne<{
      id: string;
      title: string;
      slug: string;
      category: string;
      description: string | null;
      summary: string | null;
      author: string | null;
      price: string;
      is_published: boolean;
      tags: string[];
    }>(
      `
        SELECT
          s.id,
          s.title,
          s.slug,
          c.name AS category,
          s.description,
          s.summary,
          s.author,
          s.price,
          s.is_published,
          COALESCE(ARRAY[]::text[], ARRAY[]::text[]) AS tags
        FROM stories s
        LEFT JOIN categories c ON c.id = s.category_id
        WHERE (s.id::text = $1 OR s.slug = $1)
          AND s.is_published = true
        LIMIT 1;
      `,
      [id]
    );

    if (!story) {
      return NextResponse.json({ error: 'Story not found.' }, { status: 404 });
    }

    return NextResponse.json({ story: { ...story, price: Number(story.price) } });
  } catch (error) {
    console.error('Fetch story error:', error);
    return NextResponse.json({ error: 'Unable to fetch story.' }, { status: 500 });
  }
}
