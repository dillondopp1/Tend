import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { joinClass } from '../lib/studentAuth';
import { errorText } from '../lib/messages';

export default function Join() {
  const nav = useNavigate();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pin !== pin2) return setError("Those PINs don't match. Try again!");
    setBusy(true); setError('');
    const r = await joinClass(code, name, pin);
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    nav('/adopt', { replace: true });
  }

  return (
    <main>
      <h1>Join your class</h1>
      <form onSubmit={submit}>
        <label>Class code</label>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} autoCapitalize="characters" required />
        <label>Your name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} required />
        <label>Make a 4-number PIN</label>
        <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={4} type="password" required />
        <label>Type it again</label>
        <input value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={4} type="password" required />
        <button disabled={busy}>{busy ? 'Joining…' : 'Join'}</button>
        {error && <p className="error">{error}</p>}
      </form>
    </main>
  );
}
