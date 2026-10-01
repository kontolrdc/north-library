export type StoryCategory =
  | 'History'
  | 'Culture'
  | 'Legends'
  | 'Politics'
  | 'Community';

export type Story = {
  id: string;
  title: string;
  category: StoryCategory;
  description: string;
  summary: string;
  author: string;
  cover: string;
  pages: number;
  price: number;
  featured: boolean;
  tags: string[];
};

export const stories: Story[] = [
  {
    id: 'royal-line-of-lawra',
    title: 'The Royal Line of Lawra',
    category: 'History',
    description: 'How leadership, ritual, and memory moved through northern communities across generations.',
    summary: 'A rich history of kingship, burial rites, and territorial memory from the heart of the Upper West region.',
    author: 'Northern Heritage Archive',
    cover: '/images/cover-lawra.jpg',
    pages: 9,
    price: 1,
    featured: true,
    tags: ['kingship', 'lineage', 'ritual'],
  },
  {
    id: 'kobine-festival',
    title: 'The story behind Kobine Festival',
    category: 'Culture',
    description: 'Why the Lawra dances every year, and what the festival remembers on the community’s behalf.',
    summary: 'A cultural journey through dance, drums, ancestral remembrance, and communal identity.',
    author: 'Community Archive',
    cover: '/images/cover-kobine.jpg',
    pages: 4,
    price: 1,
    featured: true,
    tags: ['festival', 'music', 'dance'],
  },
  {
    id: 'nkrumah-in-the-north',
    title: 'Nkrumah in the North',
    category: 'Politics',
    description: 'What one visit meant for a town far from the capital and for the politics that followed.',
    summary: 'An account of political mobilization, public memory, and the northern reach of national politics.',
    author: 'Research Desk',
    cover: '/images/cover-nkrumah.jpg',
    pages: 5,
    price: 1,
    featured: false,
    tags: ['politics', 'nationhood', 'mobilization'],
  },
  {
    id: 'women-of-the-basin',
    title: 'Women of the Basin',
    category: 'Community',
    description: 'How women preserved water, food, and memory across generations in northern communities.',
    summary: 'A community story centered on labor, care, agricultural knowledge, and resilience.',
    author: 'Oral History Unit',
    cover: '/images/cover-women.jpg',
    pages: 6,
    price: 1,
    featured: false,
    tags: ['women', 'water', 'community'],
  },
  {
    id: 'the-night-drummers',
    title: 'The Night Drummers',
    category: 'Legends',
    description: 'Stories of night drumming, sacred performance, and the warnings told by elders.',
    summary: 'Legendary narratives blending spirituality, rhythm, and territory.',
    author: 'Folklore Circle',
    cover: '/images/cover-drummers.jpg',
    pages: 3,
    price: 1,
    featured: false,
    tags: ['legend', 'drumming', 'ancestry'],
  },
  {
    id: 'settlement-maps',
    title: 'Settlement Maps and Memory',
    category: 'History',
    description: 'Mapping the old routes of migration, settlement, and shared memory across the north.',
    summary: 'A historical exploration of movement, place-making, and how communities remember geography.',
    author: 'Mapping Team',
    cover: '/images/cover-maps.jpg',
    pages: 8,
    price: 1,
    featured: false,
    tags: ['migration', 'territory', 'history'],
  },
];

export const categoryOrder: StoryCategory[] = [
  'History',
  'Culture',
  'Legends',
  'Politics',
  'Community',
];

export function slugifyCategory(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function prettifyCategory(slug: string): string {
  const map: Record<string, StoryCategory> = {
    history: 'History',
    culture: 'Culture',
    legends: 'Legends',
    politics: 'Politics',
    community: 'Community',
  };

  return map[slug] ?? 'History';
}

export function getCategorySummaries() {
  return categoryOrder.map((category) => ({
    name: category,
    slug: slugifyCategory(category),
    count: stories.filter((story) => story.category === category).length,
    featured: stories.find((story) => story.category === category && story.featured) ?? null,
  }));
}

export function getStoriesByCategory(categorySlug?: string) {
  if (!categorySlug) return stories;

  const category = prettifyCategory(categorySlug);
  return stories.filter((story) => story.category === category);
}

export function searchStories(query?: string) {
  const normalized = (query ?? '').trim().toLowerCase();

  if (!normalized) return stories;

  return stories.filter((story) => {
    const haystack = [
      story.title,
      story.summary,
      story.description,
      story.author,
      story.category,
      ...story.tags,
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalized);
  });
}

export function getStoryById(id: string) {
  return stories.find((story) => story.id === id) ?? null;
}
