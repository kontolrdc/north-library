'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? 'Unable to log in.');
        return;
      }
      const returnTo = new URLSearchParams(window.location.search).get('returnTo');
      const destination = returnTo?.startsWith('/books/') && !returnTo.startsWith('//')
        ? returnTo
        : '/profile';
      router.replace(destination);
      router.refresh();
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
              <p className="text-uppercase text-muted mb-2">Account</p>
              <h1 className="h3 mb-3">Log in</h1>
              <form onSubmit={submit}>
                <div className="mb-3">
                  <label className="form-label" htmlFor="login-email">Email</label>
                  <input id="login-email" name="email" type="email" autoComplete="email" className="form-control" placeholder="reader@example.com" required />
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="login-password">Password</label>
                  <input id="login-password" name="password" type="password" autoComplete="current-password" className="form-control" placeholder="Password" required />
                </div>
                {error && <p className="auth-form-error" role="alert">{error}</p>}
                <button type="submit" className="btn btn-primary w-100 mb-3" disabled={busy}>
                  {busy ? 'Signing in...' : 'Continue'}
                </button>
                <div className="d-flex justify-content-between small">
                  <Link href="/auth/login/register" className="text-decoration-none">Create account</Link>
                  <Link href="/auth/login/forget-password" className="text-decoration-none">Forgot password?</Link>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
