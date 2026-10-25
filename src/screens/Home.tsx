import { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router';
import { syncPet, getWeek, recolorPet, type AppState, type Week } from '../lib/api';
import { decayed, moodFor, type Mood } from '../domain/stats';
import { nextStage } from '../domain/growth';
import { useSession, isStudentEmail } from '../lib/useSession';
import { supabase } from '../lib/supabase';
import InstallPrompt from '../install/InstallPrompt';
import Pet, { COLOR_NAMES, swatch } from '../pet/Pet';
import { SHOW_DATE } from '../gameshow/rounds';

const MOOD_TEXT: Record<Mood, string> = {
  thriving: 'is thriving! ✨', content: 'is feeling good', sleepy: 'is a little sleepy', 'misses-you': 'misses you! 💜',
};

export default function Home() {
  const session = useSession();
  const [state, setState] = useState<AppState | null>(null);
  const [week, setWeek] = useState<Week | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(new Date());
  const [painting, setPainting] = useState(false);

  useEffect(() => {
    if (!session) return;
    syncPet().then((s) => {
      setState(s);
      if (s.weekId) getWeek(s.weekId).then(setWeek).catch(() => {});
    }).catch(() => setFailed(true));
  }, [session]);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t); }, []);

  if (session === undefined) return null;
  if (!session || !isStudentEmail(session.user.email)) return <Navigate to="/" replace />;
  if (failed) return <main className="center"><h1>Hmm…</h1><p className="sub">We couldn't reach your pet. Check your internet.</p>
    <button onClick={() => location.reload()}>Try again</button></main>;
  if (!state) return <main className="center"><p className="sub" style={{ marginTop: '30vh' }}>Waking up your pet…</p></main>;
  if (!state.pet) return <Navigate to="/adopt" replace />;

  const p = state.pet;
  const fed = decayed(p.fed, new Date(p.statsAt), now);
  const joy = decayed(p.joy, new Date(p.statsAt), now);
  const mood = moodFor(fed, joy);
  const s = state.streak!;
  const doneToday = state.sparksDone.includes(state.today);
  const next = nextStage(p.lifetimeDays);

  return (
    <main>
      <InstallPrompt />
      <div className="home-top">
        <div className="flame">🔥 {s.current}<small>day{s.current === 1 ? '' : 's'}</small></div>
        <div className="flame" title="Streak shields">🛡️ {s.shields}</div>
      </div>
      {state.events?.shieldsUsed ? <div className="banner">Your shield protected your streak! 🛡️</div> : null}
      {state.events?.streakReset ? <div className="banner">New streak starting. Your best is {s.best} 🔥 Let's go!</div> : null}

      <div className="pet-stage"><Pet species={p.species} variant={p.colorVariant} mood={mood} stage={p.stage} size={250} /></div>
      <p className="pet-name">{p.name}</p>
      <p className="pet-meta">{p.name} {MOOD_TEXT[mood]}</p>
      {painting ? <div className="card pop">
        <div className="swatches">
          {COLOR_NAMES.map((n, i) => {
            const [a, b] = swatch(p.species, i);
            return <button key={n} type="button" aria-label={n} className={`swatch ${p.colorVariant === i ? 'on' : ''}`}
              style={{ background: `linear-gradient(135deg, ${a} 55%, ${b} 55%)` }}
              onClick={() => { setState({ ...state, pet: { ...p, colorVariant: i } }); recolorPet(i).catch(() => {}); }} />;
          })}
        </div>
        <p className="center sub" style={{ margin: 0 }}>{COLOR_NAMES[p.colorVariant]}</p>
        <button className="secondary" onClick={() => setPainting(false)}>Done</button>
      </div> : <p className="center" style={{ margin: 0 }}><button className="ghost" style={{ width: 'auto', margin: 0, padding: 4 }} onClick={() => setPainting(true)}>🎨 Change color</button></p>}

      <div className="card">
        <div className="stat"><span>🍎 Fed</span><div className="bar fed"><span style={{ width: `${fed}%` }} /></div></div>
        <div className="stat"><span>🎈 Joy</span><div className="bar joy"><span style={{ width: `${joy}%` }} /></div></div>
        <p className="sub" style={{ margin: '8px 0 0', fontSize: '.95rem' }}>
          {p.stage[0].toUpperCase() + p.stage.slice(1)} · {p.lifetimeDays} day{p.lifetimeDays === 1 ? '' : 's'} tended{next ? ` · grows in ${next.atDays - p.lifetimeDays}` : ''}
        </p>
      </div>

      <div className="card">
        <p className="sub" style={{ margin: 0, fontWeight: 800 }}>This week · {week?.scripture_block ?? '…'}</p>
        <h2 style={{ marginTop: 4 }}>{week?.title ?? 'Loading…'}</h2>
        {doneToday
          ? <><span className="done-chip">✓ Today's Spark done</span>
              <Link to={`/spark/${state.today}`}><button className="secondary">Read it again</button></Link></>
          : <Link to={`/spark/${state.today}`}><button className="warm">✨ Today's Spark: feed {p.name}</button></Link>}
        <Link to="/week"><button className="secondary">This week's Sparks</button></Link>
      </div>

      {(new Date().toLocaleDateString('en-CA') === SHOW_DATE || location.search.includes('gs=1')) &&
        <Link to="/gameshow"><button className="warm">📺 Game Show is on! Join now</button></Link>}
      <Link to="/play"><button>🎮 Play games{joy < 70 ? ` · ${p.name} wants to play!` : ''}</button></Link>
      <button className="ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
    </main>
  );
}
