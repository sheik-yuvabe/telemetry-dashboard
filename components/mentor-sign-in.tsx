"use client";
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ThemeSwitch } from './theme-switch';

export function MentorSignIn({ next }: { next: string }) {
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [checking, setChecking] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    async function restore() {
      try {
        let response = await fetch('/api/auth/session', { cache: 'no-store' });
        if (response.status === 401) response = await fetch('/api/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        if (active && response.ok) { window.location.replace(next); return; }
      } catch { /* A manual sign-in can be retried if the network returns. */ }
      if (active) setChecking(false);
    }
    void restore();
    return () => { active = false; };
  }, [next]);
  async function signIn(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/sign-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Could not sign in.');
      setPassword(''); window.location.replace(next);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not sign in.'); setBusy(false); }
  }
  return <main className="auth-page"><div className="auth-theme"><ThemeSwitch/></div><section className="auth-card">
    <Image src="/yuvabe-education-logo.svg" width={64} height={64} alt="Yuvabe Education" unoptimized/>
    <p className="eyebrow">MENTOR WORKSPACE</p><h1>A clearer view of every learner.</h1><p>Sign in to see your batches, student reports, and projects.</p>
    {checking ? <p role="status">Restoring your session…</p> : <form onSubmit={signIn}>
      <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required disabled={busy}/></label>
      <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required disabled={busy}/></label>
      {error && <p role="alert" className="auth-error">{error}</p>}
      <button className="primary-button" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      <p className="auth-note">Your session is remembered on this device. Need an account or password reset? Contact your course administrator.</p>
    </form>}
  </section></main>;
}
