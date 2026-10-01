'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import Link from 'next/link';

type Profile = {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
};

export default function ProfileSettingsForm() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await fetch('/api/profile', { credentials: 'include' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'Please log in to manage your settings.');

        setProfile(data.user);
        setName(data.user.name ?? '');
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Unable to load your settings.');
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, []);

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 1_500_000) {
      setStatus('Choose a PNG, JPEG, or WebP image smaller than 1.5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setProfile((current) => current ? { ...current, avatarUrl: String(reader.result) } : current);
      setStatus('Image selected. Save your settings to apply it.');
    };
    reader.readAsDataURL(file);
  };

  const saveSettings = async () => {
    if (!profile) return;

    setSaving(true);
    setStatus('Saving settings...');
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, avatarUrl: profile.avatarUrl ?? '' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Unable to save your settings.');

      setProfile(data.user);
      setStatus('Settings saved.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to reach the server. Try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <main className="container py-5"><p className="text-muted">Loading settings...</p></main>;
  }

  if (!profile) {
    return (
      <main className="container py-5">
        <div className="alert alert-warning">{status || 'Please log in to manage your settings.'}</div>
        <Link href="/auth/login?returnTo=%2Fprofile%2Fsettings" className="btn btn-primary">Log in</Link>
      </main>
    );
  }

  return (
    <main className="container py-5">
      <div className="profile-card account-profile-card">
        <div className="profile-account-head">
          <div>
            <p className="text-uppercase text-muted mb-2">Account settings</p>
            <h1 className="mb-2">Your settings</h1>
            <p className="text-muted mb-0">{profile.email}</p>
          </div>
          <img src={profile.avatarUrl ?? '/images/profile.jpeg'} alt="Your profile" className="account-avatar" />
        </div>

        <div className="account-profile-fields">
          <label htmlFor="settings-name">Display name</label>
          <input id="settings-name" value={name} onChange={(event) => setName(event.target.value)} />

          <label htmlFor="settings-avatar">Profile picture</label>
          <input id="settings-avatar" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatarChange} />

          <button type="button" className="btn btn-primary" onClick={saveSettings} disabled={saving}>
            {saving ? 'Saving...' : 'Save settings'}
          </button>
          {status ? <p className="account-status mb-0" role="status">{status}</p> : null}
          <Link href="/profile" className="btn btn-link align-self-start px-0">Back to your library</Link>
        </div>
      </div>
    </main>
  );
}