import { useEffect, useState } from 'react';
import { Navigate, Link, useNavigate } from 'react-router';
import { syncPet, getWeek, dateForDay, type AppState, type Week } from '../lib/api';
import { useSession } from '../lib/useSession';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function WeekList() {
  const nav = useNavigate();
  const session = useSession();
  const [state, setState] = useState<AppState | null>(null);
  const [week, setWeek] = useState<Week | null>(null);

  useEffect(() => {
    if (!session) return;
    syncPet().then(async (s) => { setState(s); if (s.weekId) setWeek(await getWeek(s.weekId)); });
  }, [session]);

  if (session === undefined) return null;
  if (!session) return <Navigate to="/" replace />;
  if (!state || !week) return <main><p className="sub">Loading…</p></main>;

  return (
    <main>
      <button className="back" onClick={() => nav('/home')}>‹ Home</button>
      <p className="sub" style={{ margin: 0, fontWeight: 800 }}>{week.scripture_block}</p>
      <h1>{week.title}</h1>
      <p className="sub">Missed a day? Catch up on any earlier Spark this week. It still feeds your pet 🍎</p>
      <div className="days">
        {DAYS.map((d, k) => {
          const day = k + 1;
          const date = dateForDay(week.start_date, day);
          const spark = week.content.sparks?.find((x) => x.day === day);
          if (!spark) return null;
          const done = state.sparksDone.includes(date);
          // Only this calendar week's days up to today can be completed.
          const open = date <= state.today && date >= state.monday;
          return (
            <Link key={d} to={open ? `/spark/${date}` : '#'} style={{ textDecoration: 'none', pointerEvents: open ? 'auto' : 'none' }}>
              <button className="day" disabled={!open}>
                <span><span className="d">{d} · {date.slice(5).replace('-', '/')}</span>{spark?.section ?? '—'}</span>
                <span>{done ? '✅' : date === state.today ? '✨' : open ? '🍎' : '🔒'}</span>
              </button>
            </Link>
          );
        })}
      </div>
      <p className="center" style={{ marginTop: 20 }}><a href={week.manual_url} target="_blank" rel="noreferrer">Open the full lesson ↗</a></p>
    </main>
  );
}
