'use client';

import { FormEvent, useEffect, useEffectEvent, useState } from 'react';
import Link from 'next/link';
import AdminStoryUpload from '@/app/components/admin-story-upload';

type Story = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  description: string | null;
  summary: string | null;
  author: string | null;
  price: number;
  page_count: number;
  free_page_count: number;
  is_published: boolean;
};

type Payment = {
  reference: string;
  amount: string | number;
  status: string;
  scope: string;
  page_index: number | null;
  provider: string;
  created_at: string;
  paid_at: string | null;
  email: string | null;
  story_title: string | null;
};

type ActivityEvent = {
  id: string;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
  actor_email: string | null;
};

type AdminUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  created_at: string;
};

type Overview = {
  totals: {
    users: number;
    stories: number;
    published_stories: number;
    pending_payments: number;
    paid_payments: number;
    failed_payments: number;
    revenue: number;
  };
  interactions: Array<{ event_type: string; total: number }>;
  payments: Payment[];
  events: ActivityEvent[];
  users: AdminUser[];
  recordCounts: { payments: number; events: number };
  pageSize: number;
  paymentsPage: number;
  eventsPage: number;
  accountsPage: number;
};

const tabs = ['Overview', 'Accounts', 'Stories', 'Payments', 'Activity', 'Create story', 'Upload PDF'] as const;
type Tab = (typeof tabs)[number];

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function AdminDashboard({ email, role }: { email: string; role: string }) {
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const [paymentsPage, setPaymentsPage] = useState(0);
  const [eventsPage, setEventsPage] = useState(0);
  const [accountsPage, setAccountsPage] = useState(0);
  const [refreshVersion, setRefreshVersion] = useState(0);

  const loadData = useEffectEvent(async () => {
    setError('');
    setLoading(true);
    try {
      const [overviewResponse, storiesResponse] = await Promise.all([
        fetch(`/api/admin/overview?paymentsPage=${paymentsPage}&eventsPage=${eventsPage}&accountsPage=${accountsPage}`, { credentials: 'include', cache: 'no-store' }),
        fetch('/api/admin/stories', { credentials: 'include', cache: 'no-store' }),
      ]);
      const overviewData = await overviewResponse.json();
      const storiesData = await storiesResponse.json();
      if (!overviewResponse.ok) throw new Error(overviewData.error ?? 'Unable to load system overview.');
      if (!storiesResponse.ok) throw new Error(storiesData.error ?? 'Unable to load stories.');
      setOverview(overviewData);
      setStories(storiesData.stories ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load admin data.');
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [paymentsPage, eventsPage, accountsPage, refreshVersion]);

  const createTextStory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const paidPages = String(form.get('paidPages') ?? '').split(/\n\s*---PAGE---\s*\n/i).map((page) => page.trim()).filter(Boolean);

    try {
      const response = await fetch('/api/admin/stories/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: form.get('title'),
          category: form.get('category'),
          author: form.get('author'),
          description: form.get('description'),
          summary: form.get('summary'),
          introduction: form.get('introduction'),
          paidPages,
          isPublished: form.get('isPublished') === 'on',
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to create story.');
      setNotice(`Story published with ${result.pageCount} pages.`);
      formElement.reset();
      setRefreshVersion((version) => version + 1);
      setActiveTab('Stories');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to create story.');
    } finally {
      setBusy(false);
    }
  };

  const updateStory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingStory) return;
    setBusy(true);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch(`/api/admin/stories/${editingStory.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: form.get('title'),
          category: form.get('category'),
          author: form.get('author'),
          description: form.get('description'),
          summary: form.get('summary'),
          price: Number(form.get('price')),
          isPublished: form.get('isPublished') === 'on',
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to update story.');
      setNotice('Story updated.');
      setEditingStory(null);
      setRefreshVersion((version) => version + 1);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update story.');
    } finally {
      setBusy(false);
    }
  };

  const deleteStory = async (story: Story) => {
    if (!window.confirm(`Delete “${story.title}” and its reader pages?`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/stories/${story.id}`, { method: 'DELETE', credentials: 'include' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to delete story.');
      setNotice('Story deleted.');
      setRefreshVersion((version) => version + 1);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete story.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="container py-5 admin-console">
      <header className="admin-console-header">
        <div>
          <p className="text-uppercase text-muted mb-2">Operations</p>
          <h1 className="mb-2">Library administration</h1>
          <p className="text-muted mb-0">{email} <span className="admin-role-label">{role}</span></p>
        </div>
        <button type="button" className="btn btn-outline-secondary" onClick={() => setRefreshVersion((version) => version + 1)}>Refresh data</button>
      </header>

      {error && <div className="alert alert-warning" role="alert">{error}</div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}
      {loading && <p className="text-muted" role="status">Loading administration data...</p>}

      <nav className="admin-tabs" aria-label="Admin sections">
        {tabs.map((tab) => (
          <button key={tab} type="button" className={activeTab === tab ? 'admin-tab active' : 'admin-tab'} onClick={() => setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </nav>

      {activeTab === 'Overview' && (
        <section>
          <div className="admin-metrics">
            <Metric label="Accounts" value={overview?.totals.users} />
            <Metric label="Stories" value={`${overview?.totals.published_stories ?? 0} / ${overview?.totals.stories ?? 0}`} />
            <Metric label="Paid transactions" value={overview?.totals.paid_payments} />
            <Metric label="Pending" value={overview?.totals.pending_payments} />
            <Metric label="Failed" value={overview?.totals.failed_payments} />
            <Metric label="Revenue (GHS)" value={Number(overview?.totals.revenue ?? 0).toFixed(2)} />
          </div>
          <h2 className="h4 mt-5 mb-3">Interactions, last 30 days</h2>
          <div className="admin-event-counts">
            {(overview?.interactions ?? []).map((item) => (
              <div className="admin-event-count" key={item.event_type}><span>{item.event_type.replaceAll('.', ' ')}</span><strong>{item.total}</strong></div>
            ))}
            {!loading && !error && !overview?.interactions.length && <p className="text-muted">No recorded activity yet.</p>}
          </div>
        </section>
      )}

      {activeTab === 'Stories' && (
        <section>
          {editingStory && (
            <form className="card admin-editor-form p-4 mb-4" onSubmit={updateStory}>
              <div className="d-flex justify-content-between align-items-center"><h2 className="h4">Edit story</h2><button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setEditingStory(null)}>Close</button></div>
              <label>Title<input name="title" defaultValue={editingStory.title} required /></label>
              <label>Category<input name="category" defaultValue={editingStory.category ?? ''} /></label>
              <label>Author<input name="author" defaultValue={editingStory.author ?? ''} /></label>
              <label>Summary<textarea name="summary" defaultValue={editingStory.summary ?? ''} rows={2} /></label>
              <label>Description<textarea name="description" defaultValue={editingStory.description ?? ''} rows={3} /></label>
              <label>Page price (GHS)<input name="price" type="number" min="0.01" step="0.01" defaultValue={editingStory.price} /></label>
              <label className="admin-checkbox"><input name="isPublished" type="checkbox" defaultChecked={editingStory.is_published} /> Published</label>
              <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Save changes'}</button>
            </form>
          )}
          <div className="table-responsive">
            <table className="table admin-table align-middle">
              <thead><tr><th>Story</th><th>Category</th><th>Pages</th><th>Status</th><th>Price</th><th>Actions</th></tr></thead>
              <tbody>{stories.map((story) => (
                <tr key={story.id}>
                  <td><Link href={`/books/${story.slug}`}>{story.title}</Link><small>{story.author}</small></td>
                  <td>{story.category ?? 'Uncategorized'}</td>
                  <td>{story.page_count} <small>({story.free_page_count} free)</small></td>
                  <td><span className={story.is_published ? 'admin-status published' : 'admin-status draft'}>{story.is_published ? 'Published' : 'Draft'}</span></td>
                  <td>GHS {Number(story.price).toFixed(2)}</td>
                  <td className="admin-actions"><button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setEditingStory(story)}>Edit</button><button type="button" className="btn btn-sm btn-outline-danger" disabled={busy} onClick={() => void deleteStory(story)}>Delete</button></td>
                </tr>
              ))}</tbody>
            </table>
            {!loading && !error && !stories.length && <p className="text-muted">No stories yet.</p>}
          </div>
        </section>
      )}

      {activeTab === 'Accounts' && (
        <section className="table-responsive">
          <table className="table admin-table align-middle">
            <thead><tr><th>Created</th><th>Name</th><th>Email</th><th>Role</th></tr></thead>
            <tbody>{(overview?.users ?? []).map((user) => (
              <tr key={user.id}><td>{formatDate(user.created_at)}</td><td>{user.name ?? '—'}</td><td>{user.email}</td><td><span className="admin-status">{user.role}</span></td></tr>
            ))}</tbody>
          </table>
          {!loading && !error && !overview?.users.length && <p className="text-muted">No accounts found.</p>}
          <Pagination page={accountsPage} pageSize={overview?.pageSize ?? 50} total={overview?.totals.users ?? 0} onChange={setAccountsPage} />
        </section>
      )}

      {activeTab === 'Payments' && (
        <section className="table-responsive">
          <table className="table admin-table align-middle">
            <thead><tr><th>Created</th><th>Reader</th><th>Story / page</th><th>Reference</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>{(overview?.payments ?? []).map((payment) => (
              <tr key={payment.reference}><td>{formatDate(payment.created_at)}</td><td>{payment.email ?? 'Deleted account'}</td><td>{payment.story_title ?? 'Deleted story'}{payment.page_index !== null ? ` / page ${payment.page_index + 1}` : ''}</td><td><code>{payment.reference}</code></td><td>GHS {Number(payment.amount).toFixed(2)}</td><td><span className={`admin-status ${payment.status === 'paid' ? 'published' : 'draft'}`}>{payment.status}</span></td></tr>
            ))}</tbody>
          </table>
          {!loading && !error && !overview?.payments.length && <p className="text-muted">No payment records yet.</p>}
          <Pagination page={paymentsPage} pageSize={overview?.pageSize ?? 50} total={overview?.recordCounts.payments ?? 0} onChange={setPaymentsPage} />
        </section>
      )}

      {activeTab === 'Activity' && (
        <section className="table-responsive">
          <table className="table admin-table align-middle">
            <thead><tr><th>Time</th><th>Actor</th><th>Event</th><th>Entity</th><th>Details</th></tr></thead>
            <tbody>{(overview?.events ?? []).map((event) => (
              <tr key={event.id}><td>{formatDate(event.created_at)}</td><td>{event.actor_email ?? 'System / anonymous'}</td><td>{event.event_type}</td><td>{event.entity_type ?? '-'} {event.entity_id ?? ''}</td><td><code>{JSON.stringify(event.details)}</code></td></tr>
            ))}</tbody>
          </table>
          {!loading && !error && !overview?.events.length && <p className="text-muted">No recorded activity yet.</p>}
          <Pagination page={eventsPage} pageSize={overview?.pageSize ?? 50} total={overview?.recordCounts.events ?? 0} onChange={setEventsPage} />
        </section>
      )}

      {activeTab === 'Create story' && (
        <form className="card admin-editor-form p-4" onSubmit={createTextStory}>
          <h2 className="h4">Create a text story</h2>
          <label>Title<input name="title" required maxLength={240} /></label>
          <label>Category<input name="category" defaultValue="Community" required /></label>
          <label>Author<input name="author" /></label>
          <label>Summary<textarea name="summary" rows={2} /></label>
          <label>Description<textarea name="description" rows={3} /></label>
          <label>Free introduction<textarea name="introduction" rows={5} required /></label>
          <label>Paid pages<textarea name="paidPages" rows={12} placeholder={'Chapter 1\nStory text...\n\n---PAGE---\n\nChapter 2\nMore story text...'} /></label>
          <label className="admin-checkbox"><input name="isPublished" type="checkbox" defaultChecked /> Published</label>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Publishing...' : 'Create story'}</button>
        </form>
      )}

      {activeTab === 'Upload PDF' && (
        <AdminStoryUpload onUploaded={() => setRefreshVersion((version) => version + 1)} />
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number | undefined }) {
  return <article className="admin-metric"><span>{label}</span><strong>{value ?? '...'}</strong></article>;
}

function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (next: number) => void }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="admin-pagination">
      <span>Page {page + 1} of {pageCount} · {total} records</span>
      <div>
        <button type="button" className="btn btn-sm btn-outline-secondary" disabled={page === 0} onClick={() => onChange(page - 1)}>Previous</button>
        <button type="button" className="btn btn-sm btn-outline-secondary" disabled={page + 1 >= pageCount} onClick={() => onChange(page + 1)}>Next</button>
      </div>
    </div>
  );
}
