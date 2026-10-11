import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { supabase } from '../../lib/supabase';
import { signInTeacher } from '../../lib/studentAuth';
import { errorText } from '../../lib/messages';
import { useSession, isStudentEmail } from '../../lib/useSession';

export default function TeacherLogin() {
  const nav = useNavigate();
  const session = useSession();
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [mode, setMode] = useState<'pin' | 'link'>('pin');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const asStudent = !!session && isStudentEmail(session.user.email);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    if (mode === 'pin') {
      const r = await signInTeacher(email.trim(), pin);
      setBusy(false);
      if (!r.ok) return setError(r.error === 'bad_login' ? "That email and PIN don't match." : r.error === 'locked'
        ? 'Too many tries. Wait an hour, or use the email link instead.' : errorText(r.error));
      return nav('/teacher', { replace: true });
    }
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(), options: { emailRedirectTo: `${location.origin}/teacher`, shouldCreateUser: true },
    });
    setBusy(false);
    if (error) setError(error.message); else setSent(true);
  }

  return (
    <main>
      <Link to="/"><button className="back">‹ Back</button></Link>
      <h1>Teacher sign in</h1>
      {asStudent && <p className="banner">This phone is signed in as a student. Signing in as a teacher will sign the student out (they can sign back in with their PIN).</p>}
      {sent ? <div className="card">
        <h2>Check your email ✉️</h2>
        <p className="sub">We sent a sign-in link to <b>{email}</b>. Open it on this device. It can take a minute, and check spam.</p>
      </div> : (
        <form onSubmit={submit}>
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          {mode === 'pin' && <>
            <label>PIN</label>
            <input className="pin" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={4} type="password" required />
          </>}
          <button disabled={busy}>{busy ? 'Signing in…' : mode === 'pin' ? 'Sign in' : 'Send me a sign-in link'}</button>
          {error && <p className="error">{error}</p>}
          <button type="button" className="ghost" onClick={() => { setMode(mode === 'pin' ? 'link' : 'pin'); setError(''); }}>
            {mode === 'pin' ? 'No PIN? Email me a link instead' : 'I have a PIN'}
          </button>
        </form>
      )}
    </main>
  );
}
