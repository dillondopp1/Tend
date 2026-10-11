import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { syncPet, getWeek, completeSpark, sparkFor, dayOfWeek, type AppState, type Week, type SparkResult } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/useSession';
import Pet from '../pet/Pet';
import Confetti from '../pet/Confetti';

const KIND = { hook: 'Spark', verse: 'Scripture', meaning: 'What it means', try: 'Try this today' } as const;

export default function Spark() {
  const { date = '' } = useParams();
  const nav = useNavigate();
  const session = useSession();
  const [state, setState] = useState<AppState | null>(null);
  const [week, setWeek] = useState<Week | null>(null);
  const [i, setI] = useState(0);
  const [result, setResult] = useState<SparkResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reflecting, setReflecting] = useState(false);
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);
  const [seen, setSeen] = useState(0); // highest card index whose read time has finished

  useEffect(() => {
    if (!session) return;
    syncPet().then(async (s) => { setState(s); if (s.weekId) setWeek(await getWeek(s.weekId)); });
  }, [session]);

  // Each card stays up long enough to actually read it (about 4 words a second, 2.5–9 s) before Next unlocks.
  const cardsForTimer = week ? sparkFor(week, dayOfWeek(week.start_date, date))?.cards : undefined;
  const readMs = (k: number) => {
    const c = cardsForTimer?.[k];
    if (!c) return 0;
    const words = c.text.split(/\s+/).length + (c.type === 'verse' ? 4 : 0);
    return Math.min(9000, Math.max(2500, words * 250));
  };
  useEffect(() => {
    if (!cardsForTimer || i >= cardsForTimer.length || i < seen) return;
    const t = setTimeout(() => setSeen(i + 1), readMs(i));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, seen, cardsForTimer?.length]);

  if (session === undefined) return null;
  if (!session) return <Navigate to="/" replace />;
  if (!state || !week) return <div className="story"><p className="center" style={{ marginTop: '40vh' }}>Loading…</p></div>;
  if (!state.pet) return <Navigate to="/adopt" replace />;

  const spark = sparkFor(week, dayOfWeek(week.start_date, date));
  if (!spark) return <main className="center"><h1>No Spark yet</h1><p className="sub">Check back soon!</p>
    <button onClick={() => nav('/home')}>Home</button></main>;
  const pet = state.pet;
  const alreadyDone = state.sparksDone.includes(date);
  const cards = spark.cards;
  const last = i >= cards.length;
  // Re-reading a Spark already done for that day: no waiting.
  const ready = i < seen || alreadyDone;
  const next = () => { if (ready) setI(i + 1); };

  async function feed() {
    setBusy(true); setError('');
    try { setResult(await completeSpark(date)); }
    catch { setError("Couldn't feed right now. Check your internet and try again."); }
    finally { setBusy(false); }
  }

  async function saveReflection() {
    if (!text.trim()) return;
    const { error: e } = await supabase.from('reflections').insert({ date, week_id: week!.id, body: text.trim() });
    if (e) setError("Couldn't save that. It's okay, try again later."); else setSaved(true);
  }

  // After feeding
  if (result || (last && alreadyDone)) {
    const ext = result?.streakExtended;
    return (
      <div className="story try">
        {ext && <Confetti />}
        <div className="story-body center">
          <div className="stage-pet"><div className="pet-party"><Pet species={pet.species} variant={pet.colorVariant} mood="thriving" stage={result?.stage ?? pet.stage} size={220} animate={false} /></div></div>
          <p className="story-text">{result ? `${pet.name} is full! 🍎` : `You already fed ${pet.name} for this day 💜`}</p>
          {ext && <p className="story-ref" style={{ fontSize: '1.3rem' }}>🔥 {result!.streak} day streak!</p>}
          {result?.shieldsUsed ? <p className="story-ref">Your shield protected your streak! 🛡️</p> : null}
          {result?.milestoneReward && <p className="story-ref">🎁 You unlocked a new reward!</p>}
          {result && !result.firstTime && !ext && <p className="story-ref">Catch-up Spark counted 🌱</p>}
          {reflecting && !saved && <div style={{ marginTop: 16, textAlign: 'left' }}>
            <p style={{ fontWeight: 800 }}>{spark.reflectPrompt ?? 'What stood out to you?'}</p>
            <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} placeholder="Only you can ever see this." autoFocus />
          </div>}
          {saved && <p className="story-ref">Saved. Only you can see it. 🔒</p>}
          {error && <p className="story-ref">{error}</p>}
        </div>
        <div className="story-nav" style={{ flexDirection: 'column' }}>
          {!reflecting && !saved && <button className="secondary" style={{ flex: 'none' }} onClick={() => setReflecting(true)}>Want to think about it more?</button>}
          {reflecting && !saved && <button onClick={saveReflection} disabled={!text.trim()}>Save (private)</button>}
          <button onClick={() => nav('/home', { replace: true })}>Back to {pet.name}</button>
        </div>
      </div>
    );
  }

  const card = cards[Math.min(i, cards.length - 1)];
  return (
    <div className={`story ${last ? 'try' : card.type}`}>
      <div className="ticks">{cards.map((_, k) => <span key={k}
        className={k < i || (k === i && ready) || last ? 'on' : k === i ? 'reading' : ''}
        style={k === i && !ready ? { ['--read' as string]: `${readMs(k)}ms` } : undefined} />)}</div>
      <div className="story-head">
        <span>{spark.section.length > 42 ? week.scripture_block : spark.section}</span>
        <button onClick={() => nav('/home')}>✕</button>
      </div>
      {!last && <div className="tapzone">
        <div onClick={() => setI(Math.max(0, i - 1))} />
        <div onClick={next} />
      </div>}
      {last ? (
        <div className="story-body center" key="feed">
          <div className="stage-pet"><Pet species={pet.species} variant={pet.colorVariant} mood="thriving" stage={pet.stage} size={220} /></div>
          <p className="story-text">{pet.name} is hungry for more!</p>
          <p className="story-ref"><a href={spark.manualAnchor || week.manual_url} target="_blank" rel="noreferrer">Read the full lesson ↗</a></p>
          {error && <p className="story-ref">{error}</p>}
        </div>
      ) : (
        <div className="story-body" key={i}>
          <div className="story-kind">{KIND[card.type]}</div>
          <p className="story-text">{card.type === 'verse' ? `“${card.text}”` : card.text}</p>
          {card.type === 'verse' && <p className="story-ref">{card.ref}</p>}
          
        </div>
      )}
      <div className="story-nav">
        {i > 0 && <button className="secondary" onClick={() => setI(i - 1)}>‹</button>}
        {last
          ? <button onClick={feed} disabled={busy}>{busy ? 'Feeding…' : `Feed ${pet.name} 🍎`}</button>
          : <button onClick={next} disabled={!ready}>{ready ? 'Next' : 'Reading…'}</button>}
      </div>
    </div>
  );
}
