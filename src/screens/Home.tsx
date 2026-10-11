import { useEffect, useState } from 'react';
import { Navigate } from 'react-router';
import { syncPet, completeSpark, type AppState } from '../lib/api';
import { decayed, moodFor } from '../domain/stats';
import { useSession, isStudentEmail } from '../lib/useSession';
import { supabase } from '../lib/supabase';
import InstallPrompt from '../install/InstallPrompt';

export default function Home() {
  const session = useSession();
  const [state, setState] = useState<AppState | null>(null);
  const [now, setNow] = useState(new Date());
  const [note, setNote] = useState('');

  useEffect(() => { if (session) syncPet().then(setState); }, [session]);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t); }, []);

  if (session === undefined) return null;
  if (!session || !isStudentEmail(session.user.email)) return <Navigate to="/" replace />;
  if (!state) return <main><p>Loading…</p></main>;
  if (!state.pet) return <Navigate to="/adopt" replace />;

  const p = state.pet;
  const fed = decayed(p.fed, new Date(p.statsAt), now);
  const joy = decayed(p.joy, new Date(p.statsAt), now);
  const s = state.streak!;

  async function devSpark() {
    // Temporary until Plan 3's Spark screen: proves the server loop end to end.
    try {
      const r = await completeSpark(state!.today);
      setNote(r.streakExtended ? `🔥 Streak ${r.streak}!` : 'Fed! 🍎');
      setState(await syncPet());
    } catch { setNote('No lesson content yet.'); }
  }

  return (
    <main>
      <InstallPrompt />
      <h1>{p.name} the {p.species.replace('_', ' ')}</h1>
      <p>Mood: <b>{moodFor(fed, joy)}</b> · Stage: <b>{p.stage}</b> · Days tended: <b>{p.lifetimeDays}</b></p>
      <div className="card">
        <p>Fed</p><div className="bar"><span style={{ width: `${fed}%` }} /></div>
        <p>Joy</p><div className="bar"><span style={{ width: `${joy}%` }} /></div>
      </div>
      <div className="card">
        <h2>🔥 {s.current} day streak</h2>
        <p>Best: {s.best} · 🛡️ {s.shields}</p>
        {state.events?.shieldsUsed ? <p>Your shield protected your streak! 🛡️</p> : null}
        {state.events?.streakReset ? <p>New streak starting! Your best is {s.best} 🔥 Let's go!</p> : null}
      </div>
      <button onClick={devSpark}>Today's Spark (dev)</button>
      {note && <p>{note}</p>}
      <button className="secondary" onClick={() => supabase.auth.signOut()}>Sign out</button>
    </main>
  );
}
