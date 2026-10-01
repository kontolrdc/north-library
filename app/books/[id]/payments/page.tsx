import Link from 'next/link';
import { notFound } from 'next/navigation';
import PayStoryButton from '@/app/components/pay-story-button';
import { getServerSession } from '@/lib/auth';
import { db } from '@/lib/db';

export default async function BookPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const story = await db.queryOne<{ id: string; title: string; slug: string; author: string | null; price: string }>(
    `
      SELECT id, title, slug, author, price
      FROM stories
      WHERE (id::text = $1 OR slug = $1)
        AND is_published = true
      LIMIT 1;
    `,
    [id]
  );

  if (!story) notFound();

  const session = await getServerSession();
  const returnTo = `/books/${story.slug}/payments`;

  return (
    <main className="container py-5">
      <div className="row justify-content-center">
        <div className="col-lg-7">
          <div className="card border-0 shadow-sm">
            <div className="card-body p-4">
              <p className="text-uppercase text-muted mb-2">Secure checkout</p>
              <h1 className="h3 mb-2">Unlock the full story</h1>
              <h2 className="h5 fw-bold">{story.title}</h2>
              <p className="text-muted">By {story.author ?? 'Unknown'}</p>
              <p className="fs-4 fw-semibold mb-4">GHS {Number(story.price).toFixed(2)}</p>

              {session ? (
                <PayStoryButton bookId={story.slug} />
              ) : (
                <Link
                  href={`/auth/login?returnTo=${encodeURIComponent(returnTo)}`}
                  className="btn btn-primary"
                >
                  Log in to continue
                </Link>
              )}

              <div className="mt-4">
                <Link href={`/books/${story.slug}`} className="btn btn-outline-secondary me-2">
                  Back to story
                </Link>
                <Link href="/catalog" className="btn btn-link">Back to library</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
