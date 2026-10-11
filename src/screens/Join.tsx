import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router';
import { joinClass } from '../lib/studentAuth';
import { errorText } from '../lib/messages';

const STEPS = ['code', 'name', 'pin', 'pin2'] as const;

export default function Join() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const which = STEPS[step];

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (which === 'code' && code.length !== 6) return setError('Class codes are 6 letters and numbers.');
    if (which === 'name' && !name.trim()) return;
    if (which === 'pin' && pin.length !== 4) return setError('Your PIN needs exactly 4 numbers.');
    if (which !== 'pin2') return setStep(step + 1);
    if (pin !== pin2) { setPin2(''); return setError("Those PINs don't match. Try again!"); }
    setBusy(true);
    const r = await joinClass(code, name.trim(), pin);
    setBusy(false);
    if (!r.ok) {
      setError(errorText(r.error));
      if (r.error === 'bad_code') setStep(0);
      else if (r.error === 'name_taken' || r.error === 'bad_name') setStep(1);
      return;
    }
    nav('/adopt', { replace: true });
  }

  return (
    <main>
      {step === 0 ? <Link to="/"><button className="back">‹ Back</button></Link>
        : <button className="back" onClick={() => { setError(''); setStep(step - 1); }}>‹ Back</button>}
      <div className="steps">{STEPS.map((s, i) => <span key={s} className={i <= step ? 'on' : ''} />)}</div>
      <form onSubmit={submit} key={which} className="pop">
        {which === 'code' && <>
          <h1>What's your class code?</h1>
          <p className="sub">Your teacher has it on the board.</p>
          <input className="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            maxLength={6} autoCapitalize="characters" autoComplete="off" autoFocus />
        </>}
        {which === 'name' && <>
          <h1>What should we call you?</h1>
          <p className="sub">Your first name works. Your class sees it on game leaderboards.</p>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} autoComplete="given-name" autoFocus />
        </>}
        {which === 'pin' && <>
          <h1>Make a secret PIN</h1>
          <p className="sub">4 numbers. You'll use it to get back to your pet on any phone.</p>
          <input className="pin" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={4} type="password" autoFocus />
        </>}
        {which === 'pin2' && <>
          <h1>Type it one more time</h1>
          <p className="sub">Just to be sure.</p>
          <input className="pin" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={4} type="password" autoFocus />
        </>}
        <button disabled={busy}>{busy ? 'Joining…' : which === 'pin2' ? 'Join my class 🎉' : 'Next'}</button>
        {error && <p className="error">{error}</p>}
      </form>
    </main>
  );
}
