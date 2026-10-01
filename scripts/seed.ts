import { db } from '../lib/db';

async function main() {
  const categories = [
    { name: 'History', slug: 'history' },
    { name: 'Culture', slug: 'culture' },
    { name: 'Legends', slug: 'legends' },
    { name: 'Politics', slug: 'politics' },
    { name: 'Community', slug: 'community' },
  ];

  for (const category of categories) {
    await db.query(
      `
        INSERT INTO categories (name, slug)
        VALUES ($1, $2)
        ON CONFLICT (slug) DO NOTHING;
      `,
      [category.name, category.slug]
    );
  }

  const storySeed = [
    {
      title: 'The Royal Line of Lawra',
      slug: 'royal-line-of-lawra',
      category: 'history',
      description: 'Leadership, ritual, and memory moved through northern communities across generations.',
      summary: 'A rich history of kingship, burial rites, and territorial memory from the heart of the Upper West region.',
      author: 'Northern Heritage Archive',
      price: '1.00',
      published: true,
    },
    {
      title: 'The story behind Kobine Festival',
      slug: 'kobine-festival',
      category: 'culture',
      description: 'Why the Lawra dances every year, and what the festival remembers on the community’s behalf.',
      summary: 'A cultural journey through dance, drums, ancestral remembrance, and communal identity.',
      author: 'Community Archive',
      price: '1.00',
      published: true,
    },
    {
      title: 'Nkrumah in the North',
      slug: 'nkrumah-in-the-north',
      category: 'politics',
      description: 'What one visit meant for a town far from the capital and for the politics that followed.',
      summary: 'An account of political mobilization, public memory, and the northern reach of national politics.',
      author: 'Research Desk',
      price: '1.00',
      published: true,
    },
  ];

  for (const story of storySeed) {
    await db.query(
      'UPDATE stories SET slug = $1 WHERE title = $2 AND slug <> $1;',
      [story.slug, story.title]
    );

    await db.query(
      `
        INSERT INTO stories (title, slug, category_id, description, summary, author, price, is_published)
        SELECT $1, $2, id, $3, $4, $5, $6::numeric, $7
        FROM categories
        WHERE slug = $8
        ON CONFLICT (slug) DO NOTHING;
      `,
      [
        story.title,
        story.slug,
        story.description,
        story.summary,
        story.author,
        story.price,
        story.published,
        story.category,
      ]
    );
  }

  console.log('Seed complete');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
