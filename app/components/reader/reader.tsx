'use client';

import { useState, useEffect, useEffectEvent } from 'react';
import Link from 'next/link';
import { BUSINESS_RULES } from '@/lib/config';
import { fmtCurrency } from '@/lib/utils';
import { apiRequest } from '@/lib/api';
import { SpeedInsights } from "@vercel/speed-insights/next"

interface ReaderProps {
  bookId: string;
  chapterId: string;
}

export default function Reader({ bookId, chapterId }: ReaderProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const [content, setContent] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');
  const [pageCount, setPageCount] = useState(1);
  const [progressLoaded, setProgressLoaded] = useState(false);

  // Fetch page content directly from Server API
  const fetchPageContent = useEffectEvent(async (page: number) => {
    setLoading(true);
    setStatusMsg('');
    setRequiresLogin(false);

    try {
      const res = await fetch(`/api/books/${bookId}/content?page=${page}&chapterId=${chapterId}`, {
        credentials: 'include', // Pass httpOnly session cookies automatically
      });

      const data = await res.json();
      setPageCount(Number(data.pageCount ?? 1));

      if (res.status === 401) {
        setIsLocked(true);
        setRequiresLogin(true);
        setContent(null);
        setStatusMsg('Please log in to purchase access to this page.');
        return;
      }

      if (data.locked) {
        setIsLocked(true);
        setContent(null);
      } else {
        setIsLocked(false);
        setContent(data.content);

        void fetch(`/api/books/${bookId}/progress`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ currentPage: page }),
        });
      }
    } catch {
      setStatusMsg('Failed to load page content.');
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    async function loadProgress() {
      try {
        const response = await fetch(`/api/books/${bookId}/progress`, { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          setPageIndex(Number(data.currentPage ?? 0));
        }

        const paymentReference = new URLSearchParams(window.location.search).get('payment_reference');
        if (paymentReference) {
          try {
            const verification = await apiRequest<{ settled: boolean; continuePage: number | null }>(
              '/api/payments/paystack/verify',
              { method: 'POST', body: JSON.stringify({ reference: paymentReference }) }
            );
            if (verification.settled && verification.continuePage !== null) {
              setPageIndex(verification.continuePage);
            }
            window.history.replaceState({}, '', window.location.pathname);
          } catch (error) {
            setStatusMsg(error instanceof Error ? error.message : 'Payment verification is still pending.');
          }
        }
      } finally {
        setProgressLoaded(true);
      }
    }

    void loadProgress();
  }, [bookId]);

  useEffect(() => {
    if (!progressLoaded) return;

    const timer = window.setTimeout(() => {
      void fetchPageContent(pageIndex);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [bookId, chapterId, pageIndex, progressLoaded]);

  const handleInitiatePayment = async () => {
    try {
      const res = await apiRequest<{ authorizationUrl: string }>('/api/payments/paystack/initialize', {
        method: 'POST',
        body: JSON.stringify({ bookId, pageIndex, scope: 'page' }),
      });

      // Redirect to secure checkout
      window.location.assign(res.authorizationUrl);
    } catch (error: unknown) {
      setStatusMsg(error instanceof Error ? error.message : 'Initialization failed.');
    }
  };

  return (
    <div
      className={`reader-widget max-w-2xl mx-auto p-4 rounded shadow ${pageIndex > 0 && content ? 'protected-reader-content' : ''}`}
      onContextMenu={(event) => event.preventDefault()}
      onCopy={(event) => event.preventDefault()}
      onCut={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
    >
      <div className="reader-widget-header flex justify-between border-b pb-2 mb-4">
        <h2 className="font-bold">Story Reader</h2>
        <span>Page {pageIndex + 1} of {pageCount}</span>
      </div>

      <div className="reader-progress-track" aria-label={`Reading progress: ${Math.round(((pageIndex + 1) / pageCount) * 100)} percent`}>
        <span style={{ width: `${((pageIndex + 1) / pageCount) * 100}%` }} />
      </div>

      <div className="reader-widget-content min-h-[200px] p-4 rounded mb-4">
        {loading ? (
          <p className="text-gray-400 text-center">Loading page...</p>
        ) : isLocked ? (
          <div className="text-center py-8">
            <span className="text-2xl block mb-2">🔒 Restricted Content</span>
            <p className="text-gray-600 mb-4">
              Unlock this page for {fmtCurrency(BUSINESS_RULES.pagePrice)}.
            </p>
            {requiresLogin ? (
              <Link
                href={`/auth/login?returnTo=${encodeURIComponent(`/books/${bookId}`)}`}
                className="btn btn-primary"
              >
                Log in to continue
              </Link>
            ) : (
              <button onClick={handleInitiatePayment} className="btn btn-primary">
                Pay with Paystack
              </button>
            )}
          </div>
        ) : (
          <div className="reader-protected-copy" dangerouslySetInnerHTML={{ __html: content || '' }} />
        )}
      </div>

      {statusMsg && <p className="text-sm text-red-500 mb-3">{statusMsg}</p>}

      <div className="flex justify-between">
        <button
          onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
          disabled={pageIndex === 0}
          className="btn btn-secondary text-sm disabled:opacity-50"
        >
          Previous
        </button>
        <button
          onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
          disabled={isLocked || pageIndex >= pageCount - 1}
          className="btn btn-secondary text-sm disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}