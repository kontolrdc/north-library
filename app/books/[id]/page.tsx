import Link from 'next/link';
import { db } from '@/lib/db';
import SaveBookButton from '@/app/components/save-book-button';
import Reader from '@/app/components/reader/reader';

type StoryDetail = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  description: string | null;
  summary: string | null;
  author: string | null;
  category_slug: string | null;
  price: string;
  page_count: number;
  free_page_count: number;
  is_published: boolean;
};

export default async function StoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let story: StoryDetail | null = null;

  try {
    story = await db.queryOne<StoryDetail>(
      `
        SELECT
          s.id,
          s.title,
          s.slug,
          c.name AS category,
          c.slug AS category_slug,
          s.description,
          s.summary,
          s.author,
          s.price,
          s.page_count,
          s.free_page_count,
          s.is_published
        FROM stories s
        LEFT JOIN categories c ON c.id = s.category_id
        WHERE (s.id::text = $1 OR s.slug = $1)
          AND s.is_published = true
        LIMIT 1;
      `,
      [id]
    );
  } catch (error) {
    console.error('Story database unavailable:', error);
    return (
      <main className="container py-5">
        <div className="alert alert-warning">
          The story database is unavailable. Configure <code>DATABASE_URL</code>, start PostgreSQL, and run <code>npm run db:migrate</code>.
        </div>
        <Link href="/catalog" className="btn btn-primary">Back to catalog</Link>
      </main>
    );
  }

  if (!story) {
    return (
      <main className="container py-5">
        <div className="alert alert-warning">Story not found.</div>
        <Link href="/catalog" className="btn btn-primary">Back to catalog</Link>
      </main>
    );
  }

  return (
    <main className="container py-5">
      <div className="row g-4 align-items-start">
        <div className="col-lg-4">
          <div className="card border-0 shadow-sm">
            <div className="card-body p-4">
              <span className="badge story-category-badge mb-3">{story.category ?? 'Uncategorized'}</span>
              <h1 className="h2 fw-bold mb-3">{story.title}</h1>
              <p className="text-muted mb-4">{story.summary ?? story.description ?? 'No summary provided yet.'}</p>

              <ul className="list-unstyled small text-muted mb-4">
                <li><strong>Author:</strong> {story.author ?? 'Unknown'}</li>
                <li><strong>Price:</strong> GHS {Number(story.price).toFixed(2)}</li>
              </ul>

              <Link href={story.category_slug ? `/catalog/${story.category_slug}` : '/catalog'} className="btn btn-outline-secondary me-2">
                Back to category
              </Link>
              <Link href="/catalog" className="btn btn-primary">
                Browse library
              </Link>
              <Link href={`/books/${story.slug}/payments`} className="btn btn-outline-primary w-100 mt-3">
                Unlock full story · GHS {Number(story.price).toFixed(2)}
              </Link>
              <div className="mt-3">
                <SaveBookButton storyId={story.id} />
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-8">
          <div className="card border-0 shadow-sm">
            <div className="card-body p-4">
              <h2 className="h4 fw-bold mb-3">About this story</h2>
              <p>{story.description ?? 'This story has not been published with a full description yet.'}</p>

              <div className="reader-access-note border rounded p-4">
                <h3 className="h5 fw-bold mb-3">Reader access</h3>
                <p className="mb-0">
                  The table of contents and introduction are free. This book has {story.page_count} pages; continue page by page for GHS 1 after page {story.free_page_count}.
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <Reader bookId={story.slug} chapterId="chapter-1" />
          </div>
        </div>
      </div>
    </main>
  );
}
