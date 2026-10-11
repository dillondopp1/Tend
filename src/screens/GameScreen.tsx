import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { syncPet, getWeek, recordGame, leaderboard, type AppState, type Week, type Board, type GameResult } from '../lib/api';
import { useSession } from '../lib/useSession';
import { gameInfo } from '../games/catalog';
import { W, H, type Game } from '../games/engine';
import Pet from '../pet/Pet';
import Confetti from '../pet/Confetti';

interface Over { score: number; result: GameResult | null; board: Board | null; phraseDone: boolean; line: string }

export default function GameScreen() {
  const { game: id = '' } = useParams();
  const info = gameInfo(id);
  const nav = useNavigate();
  const session = useSession();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<AppState | null>(null);
  const [week, setWeek] = useState<Week | null>(null);
  const [over, setOver] = useState<Over | null>(null);
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (!session) return;
    syncPet().then(async (s) => { setState(s); if (s.weekId) setWeek(await getWeek(s.weekId)); });
  }, [session]);

  useEffect(() => {
    const el = canvas.current;
    if (!el || !state?.pet || !week || !info || over) return;
    const ctx = el.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = W * dpr; el.height = H * dpr;
    const c = week.content as { theme?: { palette?: string; motifs?: string[] }; gameSparks?: string[] };
    const g: Game = info.create({ species: state.pet.species, variant: state.pet.colorVariant, palette: c.theme?.palette, motifs: c.theme?.motifs, phrase: week.key_phrase });
    let raf = 0, last = performance.now(), startedAt = 0, ended = false;

    const toGame = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H] as const;
    };
    const down = (e: PointerEvent) => { e.preventDefault(); const [x, y] = toGame(e); if (!g.started) startedAt = performance.now(); g.press(x, y); };
    const move = (e: PointerEvent) => { if (g.move) { const [x, y] = toGame(e); g.move(x, y); } };
    const up = () => g.release?.();
    const keyUp = (e: KeyboardEvent) => { if (e.code === 'Space') g.release?.(); };
    const key = (e: KeyboardEvent) => { if (e.code === 'Space' && !e.repeat) { e.preventDefault(); if (!g.started) startedAt = performance.now(); g.press(W / 2, H / 2); } };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('keydown', key);
    window.addEventListener('keyup', keyUp);

    const frame = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000); last = now;
      g.step(dt);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.draw(ctx);
      if (g.over && !ended) {
        ended = true;
        const duration = performance.now() - startedAt;
        const lines = c.gameSparks ?? [];
        const finish = async () => {
          let result: GameResult | null = null;
          // Runs under a second are too short for the server's plausibility check; show them without saving.
          if (duration >= 1000) { try { result = await recordGame(info.id, g.score, duration); } catch { /* offline: still show */ } }
          const board = await leaderboard(info.id).catch(() => null);
          setOver({ score: g.score, result, board, phraseDone: g.phraseDone, line: lines[Math.floor(Math.random() * lines.length)] ?? '' });
        };
        setTimeout(finish, 700);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('keydown', key);
      window.removeEventListener('keyup', keyUp);
    };
  }, [state, week, info, over, run]);

  if (session === undefined) return null;
  if (!session) return <Navigate to="/" replace />;
  if (!info) return <Navigate to="/play" replace />;
  if (!state || !week) return <main><p className="sub">Loading…</p></main>;
  if (!state.pet) return <Navigate to="/adopt" replace />;
  const pet = state.pet;
  const c = week.content as { keyPhraseRef?: string; phraseMeaning?: string };

  return (
    <div className="game-wrap">
      <div className="game-head">
        <button className="back" style={{ color: '#fff' }} onClick={() => nav('/play')}>‹ Games</button>
        <span>{info.emoji} {info.name}</span>
      </div>
      {!over && <canvas ref={canvas} className="game-canvas" />}
      {over && (
        <div className="game-over pop">
          {over.result?.isNewBest && over.score > 0 && <Confetti />}
          <div className="stage-pet"><div className="pet-party"><Pet species={pet.species} variant={pet.colorVariant} mood="thriving" stage={pet.stage} size={130} animate={false} /></div></div>
          <p className="story-kind" style={{ color: 'var(--muted)', margin: 0 }}>{over.result?.isNewBest && over.score > 0 ? 'New personal best! 🎉' : 'Nice run!'}</p>
          <p style={{ fontSize: '3.2rem', fontWeight: 900, margin: '0 0 2px' }}>{over.score}</p>
          <p className="sub" style={{ margin: 0 }}>Best ever: {over.result?.personalBest ?? over.board?.personalBest ?? over.score} · {pet.name} +25 Joy 🎈</p>
          {over.phraseDone && <div className="banner" style={{ textAlign: 'left' }}>
            <b>Phrase complete! “{week.key_phrase}”</b> ({c.keyPhraseRef})<br />{c.phraseMeaning}</div>}
          {over.line && <div className="card" style={{ fontWeight: 700 }}>✨ {over.line}</div>}
          <button className="warm" onClick={() => { setOver(null); setRun((r) => r + 1); }}>Play again</button>
          {over.board && over.board.top.length > 0 && <div className="card">
            <h2>🏆 This week's class top 10</h2>
            {over.board.top.map((r, i) => (
              <div key={i} className="board-row" style={r.me ? { background: '#f3eeff' } : undefined}>
                <span className="rank">{i === 0 ? '👑' : i + 1}</span>
                <Pet species={r.species} variant={r.color} size={34} animate={false} />
                <span style={{ flex: 1, fontWeight: r.me ? 900 : 700 }}>{r.name}{r.me ? ' (you)' : ''}</span>
                <b>{r.score}</b>
              </div>
            ))}
          </div>}
          <button className="secondary" onClick={() => nav('/play')}>Other games</button>
          <button className="ghost" onClick={() => nav('/home')}>Back to {pet.name}</button>
        </div>
      )}
    </div>
  );
}
