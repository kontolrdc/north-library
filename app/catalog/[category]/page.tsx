import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublishedCategories, getPublishedStories } from '@/lib/catalog';

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const [categories, stories] = await Promise.all([
    getPublishedCategories(),
    getPublishedStories({ categorySlug: category }),
  ]);
  const selectedCategory = categories.find((item) => item.slug === category);

  if (!selectedCategory) notFound();

  const title = selectedCategory.name;

  return (
    <main className="container py-5">
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <p className="text-uppercase text-muted mb-2">Category</p>
          <h1 className="mb-0">{title}</h1>
        </div>
        <Link href="/catalog" className="btn btn-outline-secondary">
          Back to categories
        </Link>
      </div>

      <div className="row g-4">
        {stories.map((story) => (
          <div className="col-md-6 col-xl-4" key={story.id}>
            <div className="card h-100 shadow-sm border-0">
              <div className="card-body p-4 d-flex flex-column">
                <span className="badge story-category-badge align-self-start mb-3">{story.category}</span>
                <h2 className="h4 fw-bold mb-2">{story.title}</h2>
                <p className="text-muted flex-grow-1">{story.description}</p>

                <div className="d-flex justify-content-between text-small text-muted mb-3">
                  <span>{story.pages} pages</span>
                  <span>GHS {story.price.toFixed(2)}</span>
                </div>

                <div className="mb-3">
                  {story.tags.map((tag) => (
                    <span key={tag} className="badge bg-secondary-subtle text-secondary me-2 mb-2">
                      #{tag}
                    </span>
                  ))}
                </div>

                <Link href={`/books/${story.id}`} className="btn btn-primary mt-auto">
                  Read story
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
