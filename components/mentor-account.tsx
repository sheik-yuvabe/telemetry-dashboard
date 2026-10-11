"use client";
import Link from 'next/link';
import { useState } from 'react';
import { sessionFetch } from '@/lib/session-client';

export function MentorAccount({ email }: { email: string }) {
  const [currentPassword, setCurrent] = useState(''), [password, setPassword] = useState(''), [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  async function signOut() {
    setBusy(true); setMessage('');
    try {
      const response = await sessionFetch('/api/auth/sign-out', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!response.ok) throw new Error('Could not sign out. Please try again.');
      window.location.replace('/sign-in');
    } catch (e) { setMessage((e as Error).message); setBusy(false); }
  }
  async function change(event: React.FormEvent) {
    event.preventDefault(); setMessage('');
    if (password !== confirm) { setMessage('The new passwords do not match.'); return; }
    setBusy(true);
    try {
      const response = await sessionFetch('/api/auth/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, password }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message || 'Could not change password.');
      setCurrent(''); setPassword(''); setConfirm(''); setMessage('Your password has been updated.');
    } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  }
  return <main className="auth-page"><section className="auth-card"><Link href="/">← Back to workspace</Link><h1>Your account</h1><p>{email}</p>
    <form onSubmit={change}><h2>Change password</h2>
      <label>Current password<input type="password" value={currentPassword} onChange={e => setCurrent(e.target.value)} autoComplete="current-password" required/></label>
      <label>New password<input type="password" minLength={12} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required/></label>
      <label>Confirm new password<input type="password" minLength={12} value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" required/></label>
      <p className="auth-note">Use at least 12 characters.</p><button className="primary-button" disabled={busy}>Update password</button>
    </form>{message && <p role="status">{message}</p>}<button className="secondary-button" disabled={busy} onClick={signOut}>Sign out</button>
  </section></main>;
}
