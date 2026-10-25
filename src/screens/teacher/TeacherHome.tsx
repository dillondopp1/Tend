import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, Link } from 'react-router';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../../lib/supabase';
import { useSession, isStudentEmail } from '../../lib/useSession';
import { callFunction } from '../../lib/functions';
import { errorText } from '../../lib/messages';
import { moodFor } from '../../domain/stats';
import type { SpeciesId } from '../../domain/species';
import Pet from '../../pet/Pet';

interface ClassRow { id: string; name: string; join_code: string; timezone: string }
interface Student {
  id: string; name: string; lastActiveAt: string | null; locked: boolean;
  pet: { species: SpeciesId; color: number; name: string; stage: string; fed: number; joy: number } | null;
  streak: number; best: number; sparkToday: boolean; sparksWeek: number; gamesWeek: number;
}
interface Roster { today: string; daysSoFar: number; students: Student[] }

const MOOD_EMOJI = { thriving: '😄', content: '🙂', sleepy: '😴', 'misses-you': '💜' } as const;

function ago(iso: string | null) {
  if (!iso) return 'never';
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 2) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

function ClassCard({ c }: { c: ClassRow }) {
  const [roster, setRoster] = useState<Roster | null>(null);
  const [msg, setMsg] = useState('');
  const load = () => supabase.rpc('class_roster', { p_class: c.id }).then(({ data, error }) => {
    if (error) setMsg("Couldn't load the roster."); else setRoster(data as Roster);
  });
  useEffect(() => { load(); }, [c.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function resetPin(s: Student) {
    const pin = prompt(`New 4-number PIN for ${s.name}:`);
    if (pin === null) return;
    if (!/^\d{4}$/.test(pin)) return setMsg('A PIN has to be exactly 4 numbers.');
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const r = await callFunction(SUPABASE_URL, SUPABASE_ANON_KEY, 'reset-student-pin', { studentId: s.id, pin }, token);
    setMsg(r.ok ? `${s.name}'s PIN is now ${pin}. They can sign in with it right away.` : errorText(r.error));
    load();
  }

  const list = roster?.students ?? [];
  const today = list.filter((s) => s.sparkToday).length;
  const weekSparks = list.reduce((n, s) => n + s.sparksWeek, 0);
  const weekGames = list.reduce((n, s) => n + s.gamesWeek, 0);
  const share = `Join our class on Tend! ${location.origin}  Class code: ${c.join_code}`;

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>{c.name}</h2>
        <button className="ghost" style={{ width: 'auto', margin: 0, padding: 6 }} onClick={load}>↻</button>
      </div>
      <p style={{ margin: '6px 0' }}>Join code <b style={{ fontSize: '1.6rem', letterSpacing: 3, color: 'var(--accent-ink)' }}>{c.join_code}</b></p>
      <button className="secondary" style={{ marginTop: 4 }} onClick={() => {
        if (navigator.share) navigator.share({ text: share }).catch(() => {});
        else navigator.clipboard.writeText(share).then(() => setMsg('Invite copied!'));
      }}>Share invite</button>
      <Link to={`/teacher/gameshow?class=${c.id}`}><button className="warm">📺 Start Game Show (put this on the TV)</button></Link>

      <div className="glance">
        <div><b>{list.length}</b><span>students</span></div>
        <div><b>{today}/{list.length}</b><span>Spark today</span></div>
        <div><b>{weekSparks}</b><span>Sparks this week</span></div>
        <div><b>{weekGames}</b><span>games this week</span></div>
      </div>
      {msg && <p className="banner">{msg}</p>}

      {roster && list.length === 0 && <p className="sub">No one has joined yet. Share the code!</p>}
      {list.map((s) => {
        const mood = s.pet ? moodFor(s.pet.fed, s.pet.joy) : null;
        return (
          <div key={s.id} className="roster-row">
            {s.pet ? <Pet species={s.pet.species} variant={s.pet.color} size={48} animate={false} /> : <span className="no-pet">🥚</span>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 900 }}>{s.name} {s.sparkToday && <span title="Spark done today">✨</span>}{s.locked && <span title="Locked out"> 🔒</span>}</div>
              <div className="d">
                {s.pet ? <>{s.pet.name} {mood && MOOD_EMOJI[mood]} · </> : 'No pet yet · '}
                🔥 {s.streak} (best {s.best}) · 🍎 {s.sparksWeek}/{roster!.daysSoFar} · 🎮 {s.gamesWeek}
              </div>
              <div className="d">Active {ago(s.lastActiveAt)}</div>
            </div>
            <button className="ghost" style={{ width: 'auto', margin: 0, padding: '6px 8px', fontSize: '.85rem' }} onClick={() => resetPin(s)}>Reset PIN</button>
          </div>
        );
      })}
    </div>
  );
}

export default function TeacherHome() {
  const session = useSession();
  const [classes, setClasses] = useState<ClassRow[] | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const { data } = await supabase.from('classes').select('id,name,join_code,timezone').order('created_at');
    setClasses(data ?? []);
  }

  useEffect(() => {
    if (!session) return;
    supabase.rpc('ensure_teacher').then(({ error }) => (error ? setError(error.message) : load()));
  }, [session]);

  if (session === undefined) return null;
  if (!session || isStudentEmail(session.user.email)) return <Navigate to="/teacher/login" replace />;

  async function create(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.rpc('create_class', { p_name: name });
    if (error) return setError(error.message);
    setName(''); load();
  }

  return (
    <main>
      <h1>Your classes</h1>
      <p className="sub">Signed in as {session.user.email}. Reflections are private and never shown here.</p>
      {classes?.map((c) => <ClassCard key={c.id} c={c} />)}
      {classes && classes.length === 0 && <p className="sub">No classes yet. Create one below.</p>}
      <form onSubmit={create} className="card">
        <label style={{ marginTop: 0 }}>New class name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
        <button>Create class</button>
      </form>
      {error && <p className="error">{error}</p>}
      <button className="ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
    </main>
  );
}
