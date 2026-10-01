import { getPublishedCategories } from '@/lib/catalog';

export async function GET() {
  try {
    return Response.json({ categories: await getPublishedCategories() });
  } catch (error) {
    console.error('List categories error:', error);
    return Response.json({ error: 'Unable to load categories.' }, { status: 500 });
  }
}
