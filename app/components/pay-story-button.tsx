'use client';

import { useState } from 'react';
import { apiRequest } from '@/lib/api';

export default function PayStoryButton({ bookId }: { bookId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function startCheckout() {
    setBusy(true);
    setError('');

    try {
      const result = await apiRequest<{ authorizationUrl: string }>('/api/payments/paystack/initialize', {
        method: 'POST',
        body: JSON.stringify({ bookId, pageIndex: 0, scope: 'story' }),
      });
      window.location.assign(result.authorizationUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to start checkout. Try again.');
      setBusy(false);
    }
  }

  return (
    <>
      {error ? <p className="alert alert-danger" role="alert">{error}</p> : null}
      <button type="button" className="btn btn-primary" onClick={startCheckout} disabled={busy}>
        {busy ? 'Connecting to Paystack...' : 'Pay securely with Paystack'}
      </button>
    </>
  );
}