import { getPublishedStories } from '@/lib/catalog';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('q') ?? searchParams.get('search') ?? '';

    const stories = await getPublishedStories({ categorySlug: category ?? undefined, search });

    return Response.json({
      stories,
      category: category ?? 'all',
      search: search || null,
    });
  } catch (error) {
    console.error('List stories error:', error);
    return Response.json({ error: 'Unable to load stories.' }, { status: 500 });
  }
}
