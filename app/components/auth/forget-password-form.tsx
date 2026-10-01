'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ForgetPasswordForm({ initialToken }: { initialToken: string }) {
  const router = useRouter();
  const [token] = useState(initialToken);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [resetUrl, setResetUrl] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const requestReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? 'Unable to request a reset link.');
        return;
      }
      setMessage(result.message);
      setResetUrl(result.developmentResetUrl ?? '');
    } catch {
      setError('Unable to reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirmation) {
      setError('The passwords do not match.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? 'Unable to reset your password.');
        return;
      }
      setMessage(result.message);
      window.history.replaceState({}, '', window.location.pathname);
      window.setTimeout(() => router.replace('/auth/login'), 1200);
    } catch {
      setError('Unable to reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-6 col-lg-5">
          <div className="card shadow-sm border-0">
            <div className="card-body p-4">
              <p className="text-uppercase text-muted mb-2">Security</p>
              <h1 className="h3 mb-3">{token ? 'Choose a new password' : 'Reset password'}</h1>

              {token ? (
                <form onSubmit={resetPassword}>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="reset-password">New password</label>
                    <input id="reset-password" type="password" autoComplete="new-password" minLength={8} className="form-control" value={password} onChange={(event) => setPassword(event.target.value)} required />
                  </div>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="reset-confirmation">Confirm new password</label>
                    <input id="reset-confirmation" type="password" autoComplete="new-password" minLength={8} className="form-control" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
                  </div>
                  {error && <p className="auth-form-error" role="alert">{error}</p>}
                  {message && <p className="account-status" role="status">{message}</p>}
                  <button type="submit" className="btn btn-primary w-100" disabled={busy}>
                    {busy ? 'Updating...' : 'Update password'}
                  </button>
                </form>
              ) : (
                <form onSubmit={requestReset}>
                  <p className="text-muted">Enter your account email. If an account exists, reset instructions will be sent.</p>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="reset-email">Email</label>
                    <input id="reset-email" type="email" autoComplete="email" className="form-control" placeholder="reader@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
                  </div>
                  {error && <p className="auth-form-error" role="alert">{error}</p>}
                  {message && <p className="account-status" role="status">{message}</p>}
                  {resetUrl && <p className="small"><Link href={resetUrl}>Open local development reset link</Link></p>}
                  <button type="submit" className="btn btn-primary w-100" disabled={busy}>
                    {busy ? 'Sending...' : 'Send reset link'}
                  </button>
                </form>
              )}

              <div className="text-center small mt-3">
                <Link href="/auth/login" className="text-decoration-none">Back to login</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
