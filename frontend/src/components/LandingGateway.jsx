import React, { useState } from 'react';
import './LandingGateway.css';

export default function LandingGateway({ onEnterDashboard }) {
  const [authMode, setAuthMode] = useState('signin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [guestSnippet, setGuestSnippet] = useState(
    'function debounce(fn, delay) { ... }'
  );

  const apiUrl =
    process.env.REACT_APP_API_URL || 'http://localhost:5501';

  const handleSubmitAuth = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const email = formData.get('email');
    const password = formData.get('password');
    const endpoint =
      authMode === 'signup' ? '/api/auth/signup' : '/api/auth/signin';
    let authenticatedUser = null;

    try {
      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed.');
      }

      if (
        typeof data.token !== 'string' ||
        !data.user ||
        typeof data.user.email !== 'string'
      ) {
        throw new Error('The server returned an invalid authentication response.');
      }

      authenticatedUser = {
        email: data.user.email,
        isGuest: false,
        token: data.token,
        initialContent: '',
      };
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }

    if (authenticatedUser) {
      onEnterDashboard(authenticatedUser);
    }
  };

  const handleGuestAccess = (initialContent = '') => {
    onEnterDashboard({
      email: 'Guest User',
      isGuest: true,
      initialContent,
    });
  };

  return (
    <div className="gateway">
      <div className="gateway-glow gateway-glow-top" aria-hidden="true" />
      <div className="gateway-glow gateway-glow-bottom" aria-hidden="true" />

      <main className="gateway-layout">
        <section className="gateway-hero">
          <div className="gateway-eyebrow">
            <span aria-hidden="true">✦</span>
            AI Micro-Mentorship &amp; Visual Explainers
          </div>
          <h1>
            Master Complex Code &amp; Concepts{' '}
            <span>Instantly.</span>
          </h1>
          <p className="gateway-description">
            SkillScribe transforms dense algorithms, code, and technical
            concepts into intuitive analogies, step-by-step breakdowns, and
            interactive quizzes.
          </p>

          <div className="guest-preview">
            <div className="guest-preview-heading">
              <span>Try Instant Guest Mode</span>
              <span>No login required</span>
            </div>
            <div className="guest-preview-controls">
              <label className="visually-hidden" htmlFor="guest-snippet">
                Code or concept to explore as a guest
              </label>
              <input
                id="guest-snippet"
                type="text"
                value={guestSnippet}
                onChange={(event) => setGuestSnippet(event.target.value)}
                placeholder="Paste code or concept..."
              />
              <button
                className="gateway-primary guest-launch"
                onClick={() => handleGuestAccess(guestSnippet)}
                type="button"
              >
                Launch App
              </button>
            </div>
            <p className="guest-preview-hint">
              Your text will be ready in the analyzer when you enter.
            </p>
          </div>
        </section>

        <section className="auth-card" aria-label="Account access">
          <div className="auth-tabs" role="tablist" aria-label="Account options">
            <button
              aria-selected={authMode === 'signin'}
              className={authMode === 'signin' ? 'active' : ''}
              disabled={loading}
              onClick={() => {
                setAuthMode('signin');
                setError('');
              }}
              role="tab"
              type="button"
            >
              Sign In
            </button>
            <button
              aria-selected={authMode === 'signup'}
              className={authMode === 'signup' ? 'active' : ''}
              disabled={loading}
              onClick={() => {
                setAuthMode('signup');
                setError('');
              }}
              role="tab"
              type="button"
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmitAuth}>
            <div className="auth-field">
              <label htmlFor="auth-email">Email Address</label>
              <input
                autoComplete="email"
                id="auth-email"
                name="email"
                placeholder="name@example.com"
                required
                type="email"
              />
            </div>

            <div className="auth-field">
              <label htmlFor="auth-password">Password</label>
              <input
                autoComplete={
                  authMode === 'signin' ? 'current-password' : 'new-password'
                }
                id="auth-password"
                minLength={authMode === 'signup' ? 8 : undefined}
                name="password"
                placeholder="Enter a password"
                required
                type="password"
              />
            </div>

            <button
              className="gateway-primary auth-submit"
              disabled={loading}
              type="submit"
            >
              {loading
                ? 'Processing...'
                : authMode === 'signin'
                ? 'Access Dashboard'
                : 'Create Account & Start'}
            </button>
            <p className="auth-security-notice">
              Credentials are sent to the SkillScribe API. Your password is
              never stored in browser storage.
            </p>
          </form>

          <div className="auth-divider" aria-hidden="true">
            <span>or</span>
          </div>

          <button
            className="guest-continue"
            onClick={() => handleGuestAccess()}
            type="button"
          >
            Continue as Guest
          </button>
        </section>
      </main>
    </div>
  );
}
