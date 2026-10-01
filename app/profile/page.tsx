'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Profile = {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
};

type SavedBook = {
  id: string;
  title: string;
  slug: string;
  author: string | null;
  summary: string | null;
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [savedBooks, setSavedBooks] = useState<SavedBook[]>([]);
  const [status, setStatus] = useState('');
  const [savedBooksStatus, setSavedBooksStatus] = useState('');
  const [removingBookId, setRemovingBookId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      try {
        const [profileResponse, savedResponse] = await Promise.all([
          fetch('/api/profile', { credentials: 'include' }),
          fetch('/api/profile/saved-books', { credentials: 'include' }),
        ]);
        const profileData = await profileResponse.json();
        const savedData = await savedResponse.json();

        if (!profileResponse.ok) throw new Error(profileData.error ?? 'Please log in to view your profile.');

        setProfile(profileData.user);
        setSavedBooks(savedData.books ?? []);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Unable to load your profile.');
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, []);

  const removeSavedBook = async (storyId: string) => {
    setRemovingBookId(storyId);
    setSavedBooksStatus('');

    try {
      const response = await fetch(`/api/profile/saved-books/${storyId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error ?? 'Unable to remove this story.');

      setSavedBooks((books) => books.filter((book) => book.id !== storyId));
      setSavedBooksStatus('Story removed from your library.');
    } catch (error) {
      setSavedBooksStatus(error instanceof Error ? error.message : 'Unable to reach the server. Try again.');
    } finally {
      setRemovingBookId(null);
    }
  };

  if (loading) {
    return <main className="container py-5"><p className="text-muted">Loading profile...</p></main>;
  }

  if (!profile) {
    return (
      <main className="container py-5">
        <div className="alert alert-warning">{status || 'Please log in to view your profile.'}</div>
        <Link href="/auth/login" className="btn btn-primary">Log in</Link>
      </main>
    );
  }

  return (
    <main className="container py-5">
      <div className="profile-card account-profile-card">
        <div className="profile-account-head">
          <div>
            <p className="text-uppercase text-muted mb-2">Profile</p>
            <h1 className="mb-2">Your reading account</h1>
            <p className="mb-1">{profile.name ?? 'Reader'}</p>
            <p className="text-muted mb-0">{profile.email}</p>
          </div>
          <img
            src={profile.avatarUrl ?? '/images/profile.jpeg'}
            alt="Your profile"
            className="account-avatar"
          />
        </div>

        <Link href="/profile/settings" className="btn btn-outline-secondary mt-3">Account settings</Link>
      </div>

      <section className="saved-books-section">
        <div className="d-flex justify-content-between align-items-end mb-3">
          <div>
            <p className="text-uppercase text-muted mb-2">Your library</p>
            <h2 className="mb-0">Saved books</h2>
          </div>
          <div className="text-end">
            <span className="text-muted small">{savedBooks.length} saved</span>
            {savedBooksStatus ? <p className="small mb-0" role="status">{savedBooksStatus}</p> : null}
          </div>
        </div>

        {savedBooks.length === 0 ? (
          <div className="library-empty">Books you have paid to access will appear here.</div>
        ) : (
          <div className="row g-4">
            {savedBooks.map((book) => (
              <div className="col-md-6 col-xl-4" key={book.id}>
                <article className="card h-100 p-4">
                  <h3 className="h5 mb-2">{book.title}</h3>
                  <p className="text-muted small flex-grow-1">{book.summary ?? book.author ?? 'Saved story'}</p>
                  <div className="d-flex gap-2">
                    <Link href={`/books/${book.slug}`} className="btn btn-primary btn-sm">Read</Link>
                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => removeSavedBook(book.id)} disabled={removingBookId !== null}>
                      {removingBookId === book.id ? 'Removing...' : 'Remove'}
                    </button>
                  </div>
                </article>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
