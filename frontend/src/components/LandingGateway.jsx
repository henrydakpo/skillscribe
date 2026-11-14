import React, { useState } from 'react';
import './LandingGateway.css';

export default function LandingGateway({ onEnterDashboard }) {
  const [authMode, setAuthMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [guestSnippet, setGuestSnippet] = useState(
    'function debounce(fn, delay) { ... }'
  );

  const handleSubmitAuth = (event) => {
    event.preventDefault();
    onEnterDashboard({
      email,
      isGuest: false,
      initialContent: '',
    });
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

        <section className="auth-card" aria-label="Demo access">
          <div className="auth-tabs" role="tablist" aria-label="Account options">
            <button
              aria-selected={authMode === 'signin'}
              className={authMode === 'signin' ? 'active' : ''}
              onClick={() => setAuthMode('signin')}
              role="tab"
              type="button"
            >
              Sign In
            </button>
            <button
              aria-selected={authMode === 'signup'}
              className={authMode === 'signup' ? 'active' : ''}
              onClick={() => setAuthMode('signup')}
              role="tab"
              type="button"
            >
              Create Account
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmitAuth}>
            <div className="auth-field">
              <label htmlFor="auth-email">Email Address</label>
              <input
                autoComplete="email"
                id="auth-email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                required
                type="email"
                value={email}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="auth-password">Password</label>
              <input
                autoComplete={
                  authMode === 'signin' ? 'current-password' : 'new-password'
                }
                id="auth-password"
                placeholder="Enter a password"
                required
                type="password"
              />
            </div>

            <button className="gateway-primary auth-submit" type="submit">
              {authMode === 'signin'
                ? 'Access Dashboard'
                : 'Create Account & Start'}
            </button>
            <p className="auth-demo-notice">
              Demo only: account authentication is not connected. Your password
              is not sent or saved.
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
