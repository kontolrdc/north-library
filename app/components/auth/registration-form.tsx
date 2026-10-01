'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RegistrationForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({
          name: form.get('name'),
          email: form.get('email'),
          password: form.get('password'),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? 'Unable to create the account.');
        return;
      }
      router.replace('/auth/login');
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
        <div className="col-md-7 col-lg-6">
          <div className="card shadow-sm border-0">
            <div className="card-body p-4">
              <p className="text-uppercase text-muted mb-2">Account</p>
              <h1 className="h3 mb-3">Create account</h1>
              <form method="post" onSubmit={submit}>
                <div className="mb-3">
                  <label className="form-label" htmlFor="register-name">Full name</label>
                  <input id="register-name" name="name" type="text" autoComplete="name" className="form-control" placeholder="Your name" />
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="register-email">Email</label>
                  <input id="register-email" name="email" type="email" autoComplete="email" className="form-control" placeholder="you@example.com" required />
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="register-password">Password</label>
                  <input id="register-password" name="password" type="password" autoComplete="new-password" minLength={8} className="form-control" placeholder="At least 8 characters" required />
                </div>
                {error && <p className="auth-form-error" role="alert">{error}</p>}
                <button type="submit" className="btn btn-primary w-100 mb-3" disabled={busy}>
                  {busy ? 'Creating account...' : 'Create account'}
                </button>
                <p className="small mb-0 text-center">
                  Already have an account? <Link href="/auth/login" className="text-decoration-none">Log in</Link>
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
