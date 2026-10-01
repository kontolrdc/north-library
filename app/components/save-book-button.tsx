'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function SaveBookButton({ storyId }: { storyId: string }) {
  const [status, setStatus] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nextAction, setNextAction] = useState<'login' | 'checkout' | null>(null);

  const saveBook = async () => {
    setBusy(true);
    setStatus('Saving...');
    setNextAction(null);

    try {
      const response = await fetch('/api/profile/saved-books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ storyId }),
      });
      const data = await response.json();

      if (!response.ok) {
        setStatus(data.error ?? 'Unable to save this story.');
        setNextAction(response.status === 401 ? 'login' : response.status === 403 ? 'checkout' : null);
        return;
      }

      setSaved(true);
      setStatus('Saved to your library.');
    } catch {
      setStatus('Unable to reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="save-book-action">
      <button type="button" className="btn btn-outline-secondary" onClick={saveBook} disabled={saved || busy}>
        {busy ? 'Saving...' : saved ? 'Saved' : 'Save to my library'}
      </button>
      {status && <span className="save-book-status" role="status">{status}</span>}
      {nextAction === 'login' ? (
        <Link href={`/auth/login?returnTo=${encodeURIComponent(`/books/${storyId}`)}`} className="btn btn-link btn-sm">
          Log in
        </Link>
      ) : null}
      {nextAction === 'checkout' ? (
        <Link href={`/books/${storyId}/payments`} className="btn btn-link btn-sm">
          View purchase options
        </Link>
      ) : null}
    </div>
  );
}
