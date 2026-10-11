import { useEffect, useState } from 'react';
import { Navigate, Link, useNavigate } from 'react-router';
import { syncPet, getWeek, leaderboard, type AppState, type Week, type Board } from '../lib/api';
import { useSession } from '../lib/useSession';
import { GAMES } from '../games/catalog';
import { motifs } from '../games/engine';

export default function Play() {
  const nav = useNavigate();
  const session = useSession();
  const [state, setState] = useState<AppState | null>(null);
  const [week, setWeek] = useState<Week | null>(null);
  const [boards, setBoards] = useState<Record<string, Board>>({});

  useEffect(() => {
    if (!session) return;
    syncPet().then(async (s) => { setState(s); if (s.weekId) setWeek(await getWeek(s.weekId)); });
    GAMES.forEach((g) => leaderboard(g.id).then((b) => setBoards((x) => ({ ...x, [g.id]: b }))).catch(() => {}));
  }, [session]);

  if (session === undefined) return null;
  if (!session) return <Navigate to="/" replace />;
  if (!state) return <main><p className="sub">Loading…</p></main>;
  if (!state.pet) return <Navigate to="/adopt" replace />;
  const theme = (week?.content as { theme?: { motifs?: string[] } } | undefined)?.theme;

  return (
    <main>
      <button className="back" onClick={() => nav('/home')}>‹ Home</button>
      <h1>Play with {state.pet.name}</h1>
      <p className="sub">Every game gives {state.pet.name} +25 Joy 🎈. Collect this week's words:<br />
        <b style={{ color: 'var(--accent-ink)' }}>“{week?.key_phrase ?? '…'}”</b> {theme && <span>{motifs(theme.motifs).join(' ')}</span>}
      </p>
      <div className="days">
        {GAMES.map((g) => {
          const b = boards[g.id];
          const leader = b?.top[0];
          return (
            <Link key={g.id} to={`/play/${g.id}`} style={{ textDecoration: 'none' }}>
              <button className="day" style={{ padding: '16px 14px' }}>
                <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: '2rem' }}>{g.emoji}</span>
                  <span>{g.name}<span className="d">{g.blurb}</span>
                    <span className="d">{b?.weekBest != null ? `Your best this week: ${b.weekBest}` : 'Not played yet'}
                      {leader ? ` · 👑 ${leader.name} ${leader.score}` : ''}</span></span>
                </span>
                <span>▶</span>
              </button>
            </Link>
          );
        })}
      </div>
      <p className="sub center" style={{ marginTop: 18, fontSize: '.9rem' }}>Leaderboards reset every Monday with the new lesson.</p>
    </main>
  );
}
