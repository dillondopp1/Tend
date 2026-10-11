import { useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';

export default function TeacherLogin() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithOtp({
      email, options: { emailRedirectTo: `${location.origin}/teacher` },
    });
    if (error) setError(error.message); else setSent(true);
  }

  return (
    <main>
      <h1>Teacher sign in</h1>
      {sent ? <p>Check your email for a sign-in link ✉️</p> : (
        <form onSubmit={submit}>
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <button>Send me a link</button>
          {error && <p className="error">{error}</p>}
        </form>
      )}
    </main>
  );
}
