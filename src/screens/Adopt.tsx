import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { SPECIES, type SpeciesId } from '../domain/species';
import { adoptPet } from '../lib/api';
import Pet, { Egg, COLOR_NAMES, swatch } from '../pet/Pet';
import Confetti from '../pet/Confetti';

type Step = 'animal' | 'color' | 'name' | 'hatch';
const ORDER: Step[] = ['animal', 'color', 'name'];

export default function Adopt() {
  const nav = useNavigate();
  const [step, setStep] = useState<Step>('animal');
  const [species, setSpecies] = useState<SpeciesId | null>(null);
  const [color, setColor] = useState(0);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'egg' | 'crack' | 'out'>('egg');
  const label = SPECIES.find((s) => s.id === species)?.label ?? '';

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!species || !name.trim()) return;
    setError(''); setBusy(true);
    try {
      await adoptPet(species, color, name.trim());
      setStep('hatch'); setPhase('egg');
      setTimeout(() => setPhase('crack'), 1400);
      setTimeout(() => setPhase('out'), 2300);
    } catch (err) {
      // Already adopted (e.g. double tap or a second device) — just go home.
      if ((err as { code?: string }).code === '23505') return nav('/home', { replace: true });
      setError("Couldn't adopt right now. Try again!");
    } finally { setBusy(false); }
  }

  if (step === 'hatch') return (
    <main className="center" style={{ paddingTop: '10vh' }}>
      {phase !== 'out' ? <>
        <div className="stage-pet"><Egg size={240} cracking={phase === 'crack'} /></div>
        <h1>{phase === 'egg' ? 'Something is wiggling…' : 'Here it comes!'}</h1>
      </> : <>
        <Confetti />
        <div className="stage-pet pop"><Pet species={species!} variant={color} mood="thriving" stage="hatchling" size={260} /></div>
        <h1>Meet {name.trim()}! 🎉</h1>
        <p className="sub">Do a Spark each day to keep {name.trim()} fed and grow your streak.</p>
        <button onClick={() => nav('/home', { replace: true })}>Let's go!</button>
      </>}
    </main>
  );

  const idx = ORDER.indexOf(step);
  return (
    <main>
      {step !== 'animal' && <button className="back" onClick={() => setStep(ORDER[idx - 1])}>‹ Back</button>}
      <div className="steps">{ORDER.map((s, i) => <span key={s} className={i <= idx ? 'on' : ''} />)}</div>
      {step === 'animal' && <div className="pop">
        <h1>Pick your pet</h1>
        <p className="sub">Choose the one that feels like you.</p>
        <div className="grid">
          {SPECIES.map((s) => (
            <button key={s.id} type="button" className={`pick ${species === s.id ? 'on' : ''}`}
              onClick={() => { setSpecies(s.id); setColor(0); setStep('color'); }}>
              <Pet species={s.id} size={92} animate={false} />
              {s.label}
            </button>
          ))}
        </div>
      </div>}
      {step === 'color' && species && <div className="pop">
        <h1>Pick a color</h1>
        <div className="stage-pet"><Pet species={species} variant={color} mood="thriving" size={220} /></div>
        <div className="swatches">
          {COLOR_NAMES.map((n, i) => {
            const [a, b] = swatch(species, i);
            return <button key={n} type="button" aria-label={n} className={`swatch ${color === i ? 'on' : ''}`}
              style={{ background: `linear-gradient(135deg, ${a} 55%, ${b} 55%)` }} onClick={() => setColor(i)} />;
          })}
        </div>
        <p className="center sub">{COLOR_NAMES[color]}</p>
        <button onClick={() => setStep('name')}>This one!</button>
      </div>}
      {step === 'name' && species && <form className="pop" onSubmit={submit}>
        <h1>Name your {label.toLowerCase()}</h1>
        <div className="stage-pet"><Pet species={species} variant={color} mood="thriving" size={180} /></div>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="Name" autoFocus required />
        <button disabled={!name.trim() || busy}>{busy ? 'Hatching…' : 'Hatch my pet 🥚'}</button>
        {error && <p className="error">{error}</p>}
      </form>}
    </main>
  );
}
