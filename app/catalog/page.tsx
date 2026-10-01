import Link from 'next/link';
import { getPublishedCategories, getPublishedStories } from '@/lib/catalog';

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; q?: string }>;
}) {
  const params = await searchParams;
  const query = (params.search ?? params.q ?? '').trim();
  const categories = await getPublishedCategories();
  const results = query ? await getPublishedStories({ search: query }) : [];

  return (
    <main className="container py-5">
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <p className="text-uppercase text-muted mb-2">Library</p>
          <h1 className="mb-0">{query ? `Search results for “${query}”` : 'Browse by category'}</h1>
        </div>
      </div>

      {query ? (
        <div className="mb-4">
          <p className="text-muted mb-0">
            {results.length} story{results.length === 1 ? '' : 'ies'} found.
          </p>
        </div>
      ) : null}

      {query ? (
        results.length > 0 ? (
          <div className="row g-4 mb-5">
            {results.map((story) => (
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
                    <Link href={`/books/${story.id}`} className="btn btn-primary mt-auto">
                      Read story
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card border-0 shadow-sm mb-5">
            <div className="card-body p-5 text-center">
              <h2 className="h4 fw-bold mb-2">No results found</h2>
              <p className="text-muted mb-0">
                We could not find any stories matching “{query}”. Try a different keyword or browse the categories below.
              </p>
            </div>
          </div>
        )
      ) : null}

      {!query ? (
        <div className="row g-4">
          {categories.map((category) => (
            <div className="col-md-6 col-xl-4" key={category.slug}>
              <Link href={`/catalog/${category.slug}`} className="text-decoration-none text-reset">
                <div className="card h-100 shadow-sm border-0">
                  <div className="card-body p-4">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <span className="badge bg-primary-subtle text-primary px-3 py-2 rounded-pill">
                        {category.count} stories
                      </span>
                      <span className="text-muted small">{category.name}</span>
                    </div>

                    <h2 className="h4 fw-bold mb-3">{category.name}</h2>

                    {category.featured ? (
                      <p className="mb-0 text-muted">
                        Featured: <span className="story-featured-title fw-semibold">{category.featured.title}</span>
                      </p>
                    ) : (
                      <p className="mb-0 text-muted">New stories added regularly.</p>
                    )}
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      ) : null}
    </main>
  );
}
