'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';

interface UserState {
  isAuthenticated: boolean;
  isAdmin: boolean;
  name?: string;
  avatarUrl?: string;
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  // UI State Management
  const [isNavCollapsed, setIsNavCollapsed] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [authError, setAuthError] = useState('');

  // Simulated User Auth State (Connect this to your Auth Provider / JWT Context)
  const [user, setUser] = useState<UserState>({
    isAuthenticated: true,
    isAdmin: false,
    avatarUrl: '/images/profile.jpeg',
  });

  const profileRef = useRef<HTMLDivElement>(null);

  const handleSearchSubmit = () => {
    const trimmed = searchQuery.trim();
    setIsSearchOpen(false);

    if (!trimmed) {
      router.push('/catalog');
      return;
    }

    router.push(`/catalog?search=${encodeURIComponent(trimmed)}`);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    setAuthError('');

    try {
      const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      if (!response.ok) throw new Error('Unable to sign out. Try again.');

      setUser({ isAuthenticated: false, isAdmin: false });
      setIsProfileOpen(false);
      router.replace('/');
      router.refresh();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to sign out. Try again.');
    } finally {
      setSigningOut(false);
    }
  };

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    async function loadAccount() {
      const sessionResponse = await fetch('/api/auth/me', { credentials: 'include' });
      if (!sessionResponse.ok) {
        setUser({ isAuthenticated: false, isAdmin: false });
        return;
      }

      const sessionData = await sessionResponse.json();
      const profileResponse = await fetch('/api/profile', { credentials: 'include' });
      const profileData = profileResponse.ok ? await profileResponse.json() : { user: null };

      setUser({
        isAuthenticated: true,
        isAdmin: sessionData.user?.role === 'admin' || sessionData.user?.role === 'superadmin',
        name: profileData.user?.name ?? sessionData.user?.email,
        avatarUrl: profileData.user?.avatarUrl ?? '/images/profile.jpeg',
      });
    }

    void loadAccount();
  }, [pathname]);

  return (
    <section id="header">
      <nav className="navbar navbar-expand-lg border-bottom sticky-top py-3">
        <div className="container">
          {/* Brand Logo & Title */}
          <Link href="/" className="navbar-brand fs-4 d-flex align-items-center gap-2">
            <Image
              src="/images/kontol-logo.jpeg"
              alt="Kontol logo"
              width={40}
              height={40}
              className="brand-logo"
              priority
            />
            <span className="fw-bold">Northern Heritage Library</span>
          </Link>

          {/* Mobile Toggler */}
          <button
            className="navbar-toggler"
            type="button"
            onClick={() => setIsNavCollapsed(!isNavCollapsed)}
            aria-controls="navbarNav"
            aria-expanded={!isNavCollapsed}
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon"></span>
          </button>

          {/* Search Trigger */}
          <button
            id="search-toggle"
            className="search-buttton btn btn-outline-secondary btn-search btn-sm rounded-pill px-3 fw-semibold my-2 my-lg-0"
            type="button"
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            aria-expanded={isSearchOpen}
            aria-label="Toggle search"
          >
            <i className="fa-solid fa-magnifying-glass"></i>
          </button>

          {/* Collapsible Content */}
          <div className={`navbar-collapse ${!isNavCollapsed ? 'show' : ''}`} id="navbarNav">
            {/* Top Up CTA */}
            <ul className="navbar-nav ms-auto align-items-lg-center">
              <li className="nav-item">
                <Link
                  href="/wallet/topup"
                  className="btn btn-topup rounded-pill px-3 fw-semibold justify-content-center gap-2 d-flex align-items-center text-decoration-none"
                >
                  <span id="span-balance-badge" className="rounded-pill px-3 py-2 text-center me-2">
                    <i className="fa-solid fa-lock me-2"></i>
                    <span id="nav-balance">Pay per page</span>
                  </span>
                  Top Up
                </Link>
              </li>
            </ul>
          </div>

          {/* User Profile Dropdown Menu */}
          <div className="profile-wrap ms-2 position-relative" ref={profileRef}>
            <button
              id="profile-trigger"
              className="profile-trigger border-0 bg-transparent p-0"
              type="button"
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              aria-label="Open profile menu"
              aria-expanded={isProfileOpen}
            >
              <Image
                src={user.avatarUrl || '/images/profile.jpeg'}
                alt="User avatar"
                width={40}
                height={40}
                className="rounded-circle"
              />
            </button>

            {/* Dynamic Dropdown List */}
            {isProfileOpen && (
              <div id="profile-menu" className="profile-menu shadow rounded border p-2 position-absolute end-0 mt-2 z-3">
                {user.isAuthenticated ? (
                  <>
                    <Link href="/profile" className="dropdown-item py-2 px-3" onClick={() => setIsProfileOpen(false)}>
                      View profile
                    </Link>
                    <Link href="/profile/reads" className="dropdown-item py-2 px-3" onClick={() => setIsProfileOpen(false)}>
                      Reading list
                    </Link>
                    <Link href="/profile/settings" className="dropdown-item py-2 px-3" onClick={() => setIsProfileOpen(false)}>
                      Settings
                    </Link>

                    {user.isAdmin && (
                      <Link href="/admin" className="dropdown-item py-2 px-3 text-warning fw-semibold" onClick={() => setIsProfileOpen(false)}>
                        Admin console
                      </Link>
                    )}

                    <hr className="dropdown-divider my-1" />
                    <button
                      type="button"
                      className="dropdown-item py-2 px-3 text-danger border-0 bg-transparent text-start w-100"
                      onClick={() => void handleSignOut()}
                      disabled={signingOut}
                    >
                      {signingOut ? 'Signing out...' : 'Sign out'}
                    </button>
                    {authError ? <p className="small text-danger mb-0 px-3" role="alert">{authError}</p> : null}
                  </>
                ) : (
                  <>
                    <Link href="/auth/login" className="dropdown-item py-2 px-3" onClick={() => setIsProfileOpen(false)}>
                      Log in
                    </Link>
                    <Link href="/auth/login/register" className="dropdown-item py-2 px-3" onClick={() => setIsProfileOpen(false)}>
                      Create account
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Collapsible Search Panel */}
      {isSearchOpen && (
        <div id="search-panel" className="search-panel p-3 border-bottom">
          <div className="container">
            <div className="search-box d-flex align-items-center gap-2">
              <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
              <label className="visually-hidden" htmlFor="site-search">
                Search
              </label>
              <input
                id="site-search"
                className="form-control"
                type="search"
                placeholder="Search books, places, or legends..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleSearchSubmit();
                  }
                }}
              />
              <button
                id="search-submit"
                className="btn btn-sm btn-primary"
                type="button"
                onClick={handleSearchSubmit}
              >
                Search
              </button>
              <button
                id="search-close"
                className="btn btn-sm btn-outline-secondary"
                type="button"
                onClick={() => setIsSearchOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}