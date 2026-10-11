import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { signInStudent } from '../lib/studentAuth';
import { errorText } from '../lib/messages';

export default function Login() {
  const nav = useNavigate();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    const r = await signInStudent(code, name, pin);
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    nav('/home', { replace: true });
  }

  return (
    <main>
      <h1>Welcome back!</h1>
      <form onSubmit={submit}>
        <label>Class code</label>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} autoCapitalize="characters" required />
        <label>Your name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} required />
        <label>PIN</label>
        <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={4} type="password" required />
        <button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        {error && <p className="error">{error}</p>}
      </form>
    </main>
  );
}
