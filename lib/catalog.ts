import { db } from '@/lib/db';

export type CatalogStory = {
  id: string;
  title: string;
  slug: string;
  category: string;
  description: string;
  summary: string;
  author: string;
  pages: number;
  price: number;
  tags: string[];
};

export type CatalogCategory = {
  name: string;
  slug: string;
  count: number;
  featured: { title: string } | null;
};

type CatalogCategoryRow = {
  name: string;
  slug: string;
  count: number;
  featured_title: string | null;
};

type CatalogStoryRow = Omit<CatalogStory, 'price' | 'tags'> & {
  price: string;
};

export async function getPublishedStories({
  categorySlug,
  search,
}: {
  categorySlug?: string;
  search?: string;
} = {}): Promise<CatalogStory[]> {
  const rows = await db.query<CatalogStoryRow>(
    `
      SELECT
        s.id,
        s.title,
        s.slug,
        COALESCE(c.name, 'Uncategorized') AS category,
        COALESCE(s.description, '') AS description,
        COALESCE(s.summary, '') AS summary,
        COALESCE(s.author, 'Unknown') AS author,
        s.page_count AS pages,
        s.price
      FROM stories s
      LEFT JOIN categories c ON c.id = s.category_id
      WHERE s.is_published = true
        AND ($1::text IS NULL OR c.slug = $1)
        AND (
          $2::text = ''
          OR LOWER(s.title) LIKE '%' || LOWER($2) || '%'
          OR LOWER(COALESCE(s.summary, '')) LIKE '%' || LOWER($2) || '%'
          OR LOWER(COALESCE(s.description, '')) LIKE '%' || LOWER($2) || '%'
          OR LOWER(COALESCE(s.author, '')) LIKE '%' || LOWER($2) || '%'
          OR LOWER(COALESCE(c.name, '')) LIKE '%' || LOWER($2) || '%'
        )
      ORDER BY s.created_at DESC;
    `,
    [categorySlug ?? null, search?.trim() ?? '']
  );

  return rows.map((story) => ({ ...story, price: Number(story.price), tags: [] }));
}

export async function getPublishedCategories(): Promise<CatalogCategory[]> {
  const rows = await db.query<CatalogCategoryRow>(
    `
      SELECT
        c.name,
        c.slug,
        COUNT(s.id)::int AS count,
        (
          SELECT featured_story.title
          FROM stories AS featured_story
          WHERE featured_story.category_id = c.id
            AND featured_story.is_published = true
          ORDER BY featured_story.created_at DESC
          LIMIT 1
        ) AS featured_title
      FROM categories c
      LEFT JOIN stories s
        ON s.category_id = c.id
        AND s.is_published = true
      GROUP BY c.id, c.name, c.slug
      ORDER BY c.name;
    `
  );

  return rows.map(({ name, slug, count, featured_title }) => ({
    name,
    slug,
    count,
    featured: featured_title ? { title: featured_title } : null,
  }));
}