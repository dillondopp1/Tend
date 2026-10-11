import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { supabase } from '../../lib/supabase';
import { useSession, isStudentEmail } from '../../lib/useSession';

export default function TeacherLogin() {
  const session = useSession();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const asStudent = !!session && isStudentEmail(session.user.email);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(), options: { emailRedirectTo: `${location.origin}/teacher` },
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
          <button disabled={busy}>{busy ? 'Sending…' : 'Send me a sign-in link'}</button>
          {error && <p className="error">{error}</p>}
        </form>
      )}
    </main>
  );
}
