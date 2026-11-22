import { useEffect, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { supabase } from '../../lib/supabase';
import { useSession, isStudentEmail } from '../../lib/useSession';
import Pet from '../../pet/Pet';
import Confetti from '../../pet/Confetti';
import type { SpeciesId } from '../../domain/species';
import { boardFor, RESOURCE_ICON, RESOURCE_NAME, WIN_POINTS, type Resource } from '../../boardgame/board';
import {
  newGame, addPlayer, start, settle, roll, continueCard, build, upgrade, proposeTrade, cancelTrade, acceptTrade,
  toPublic, type Game, type Hand,
} from '../../boardgame/engine';
import { openWire, type Wire } from '../../boardgame/channel';
import { sfxDiceRoll, sfxGood, sfxWander, sfxHome } from '../../boardgame/sfx';
import '../../boardgame/boardgame.css';

const key = (classId: string) => `bg-host-${classId}`;
let counter = 0;
const newId = () => `${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
function load(classId: string, boardId: string): Game {
  try { const r = localStorage.getItem(key(classId)); if (r) { const g = JSON.parse(r) as Game; if (g.boardId === boardId) return g; } } catch { /* fresh game */ }
  return newGame(boardId);
}

export default function BoardGameHost() {
  const session = useSession();
  const [params] = useSearchParams();
  const [cls, setCls] = useState<{ id: string; name: string; join_code: string } | null | undefined>(undefined);
  useEffect(() => {
    if (!session) return;
    const q = supabase.from('classes').select('id,name,join_code').order('created_at');
    const want = params.get('class');
    (want ? q.eq('id', want) : q).then(({ data }) => setCls(data?.[0] ?? null));
  }, [session, params]);
  if (import.meta.env.DEV && params.get('demo')) return <Stage classId="demo" code="DEMO" />;
  if (session === undefined) return null;
  if (!session || isStudentEmail(session.user.email)) return <Navigate to="/teacher/login" replace />;
  if (cls === undefined) return <main className="center"><p className="sub">Loading…</p></main>;
  if (cls === null) return <main className="center"><p className="sub">No class found.</p></main>;
  return <Stage classId={cls.id} code={cls.join_code} />;
}

function Stage({ classId, code }: { classId: string; code: string }) {
  const b = boardFor();
  const [game, setGame] = useState<Game>(() => load(classId, b.id));
  const ref = useRef(game);
  const wire = useRef<Wire | null>(null);
  const [rollingFor, setRollingFor] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const publish = () => wire.current?.sendState(toPublic(ref.current));
  const update = (f: (g: Game) => Game) => {
    const n = f(ref.current);
    if (n === ref.current) return;
    ref.current = n; setGame(n);
    try { localStorage.setItem(key(classId), JSON.stringify(n)); } catch { /* storage full or blocked */ }
    publish();
  };

  const doSettle = (id: string, tileId: number) => update((g) => settle(g, id, tileId));

  const doRoll = (id: string) => {
    if (rollingFor) return;
    const g0 = ref.current;
    if (toPublic(g0).currentId !== id || g0.card) return;
    setRollingFor(id);
    sfxDiceRoll(6);
    timer.current = setTimeout(() => {
      setRollingFor(null);
      const die1 = 1 + Math.floor(Math.random() * 6), die2 = 1 + Math.floor(Math.random() * 6);
      const before = ref.current;
      update((g) => roll(g, id, die1, die2));
      const after = ref.current;
      const total = (p: typeof after.players[number]) => Object.values(p.resources).reduce((a, x) => a + x, 0);
      const gained = after.players.reduce((n, p) => n + total(p), 0) - before.players.reduce((n, p) => n + total(p), 0);
      if (after.card) sfxWander();
      else if (gained > 0) { sfxGood(); setBurst((n) => n + 1); }
    }, 650);
  };
  const restart = () => update(() => newGame(b.id));

  useEffect(() => {
    const w = openWire(classId, (m) => {
      if (m.t === 'hello') update((g) => addPlayer(g, m.p));
      else if (m.t === 'settle') doSettle(m.id, m.tileId);
      else if (m.t === 'roll') doRoll(m.id);
      else if (m.t === 'continueCard') update(continueCard);
      else if (m.t === 'build') { const before = ref.current; update((g) => build(g, m.id, m.tileId)); if (ref.current !== before) { sfxGood(); setBurst((n) => n + 1); if (ref.current.phase === 'finished') sfxHome(); } }
      else if (m.t === 'upgrade') { const before = ref.current; update((g) => upgrade(g, m.id, m.tileId)); if (ref.current !== before) { sfxGood(); setBurst((n) => n + 1); if (ref.current.phase === 'finished') sfxHome(); } }
      else if (m.t === 'proposeTrade') update((g) => proposeTrade(g, m.id, m.give, m.want, m.to, newId));
      else if (m.t === 'cancelTrade') update((g) => cancelTrade(g, m.offerId, m.id));
      else if (m.t === 'acceptTrade') { const before = ref.current; update((g) => acceptTrade(g, m.offerId, m.id)); if (ref.current !== before) sfxGood(); }
    }, () => {}, publish);
    wire.current = w;
    const beat = setInterval(publish, 3000);
    return () => { clearInterval(beat); w.close(); if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const get = () => (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<typeof lock> } }).wakeLock?.request('screen')
      .then((l) => { lock = l; }).catch(() => {});
    get();
    const again = () => { if (!document.hidden) get(); };
    document.addEventListener('visibilitychange', again);
    return () => { document.removeEventListener('visibilitychange', again); lock?.release().catch(() => {}); };
  }, []);

  const g = game;
  const pub = toPublic(g);
  const currentPlayer = g.players.find((p) => p.id === pub.currentId);
  const standings = [...g.players].sort((x, y) => y.points - x.points);

  return (
    <div className="bg bg-tv">
      {burst > 0 && <Confetti key={burst} />}
      <div className="bg-logo">{b.title.toUpperCase()}</div>
      <p className="bg-sub">Class code <b className="bg-code">{code}</b> · open Tend on your phone and tap <b>Board Game</b></p>

      {g.phase === 'lobby' && (
        <div className="bg-center">
          <p className="bg-big">Grab your tokens!</p>
          <div className="bg-players">
            {g.players.length === 0 && <span className="bg-sub">Waiting for players…</span>}
            {g.players.map((p) => <Avatar key={p.id} p={p} />)}
          </div>
          <button className="bg-go main" onClick={() => update(start)} disabled={g.players.length === 0}>Start the game ▸</button>
        </div>
      )}

      {g.phase !== 'lobby' && (
        <>
          <Tiles g={g} onPick={g.phase === 'settle' && currentPlayer ? (tileId) => doSettle(currentPlayer.id, tileId) : undefined} />

          {g.phase === 'settle' && currentPlayer && (
            <p className="bg-sub">{currentPlayer.name}, tap a tile to build your first Altar there (or do it from your phone).</p>
          )}

          {g.phase === 'playing' && (
            <div className="bg-standings">
              {standings.map((p) => (
                <div key={p.id} className={`bg-stand-row ${p.id === pub.currentId ? 'current' : ''}`}>
                  <span className="bg-stand-rank">{standings[0].id === p.id && p.points > 0 ? '👑' : ''}</span>
                  <Pet species={p.species as SpeciesId} variant={p.color} mood="content" stage="grown" size={26} animate={false} />
                  <span className="bg-stand-name">{p.name}</span>
                  <div className="bg-stand-bar"><div className="bg-stand-fill" style={{ width: `${Math.min(100, (p.points / WIN_POINTS) * 100)}%` }} /></div>
                  <span className="bg-stand-pts">{p.points}</span>
                </div>
              ))}
            </div>
          )}

          {g.phase === 'playing' && !pub.card && currentPlayer && (
            <div className="bg-turn">
              <p className="bg-big">{currentPlayer.name}'s turn</p>
              <button className={`bg-die ${rollingFor ? 'spin' : ''}`} onClick={() => doRoll(currentPlayer.id)} disabled={!!rollingFor}>
                {rollingFor ? '🎲 🎲' : pub.lastRoll ? `🎲${pub.lastRoll[0]} 🎲${pub.lastRoll[1]}` : '🎲 🎲'}
              </button>
              <p className="bg-sub">Tap to roll for {currentPlayer.name} — or they roll from their own phone</p>
            </div>
          )}

          {pub.card && (
            <div className="bg-card">
              <p className="bg-tag">{pub.card.prompt}</p>
              {pub.card.q && <p className="bg-ask">{pub.card.q}</p>}
              {pub.card.a && <p className="bg-answer">{pub.card.a}</p>}
              <button className="bg-go main" onClick={() => update(continueCard)}>Continue ▸</button>
            </div>
          )}

          {g.trades.length > 0 && g.phase === 'playing' && (
            <div className="bg-trades">
              {g.trades.map((t) => {
                const from = g.players.find((p) => p.id === t.from)?.name ?? '?';
                const to = t.to ? g.players.find((p) => p.id === t.to)?.name : 'anyone';
                return (
                  <div key={t.id} className="bg-trade-card">
                    <b>{from}</b> offers {fmtHand(t.give)} for {fmtHand(t.want)} {t.to ? `with ${to}` : '(open to anyone)'}
                  </div>
                );
              })}
            </div>
          )}

          {g.phase === 'finished' && (
            <div className="bg-center">
              <p className="bg-big">{g.players.find((p) => p.id === g.winnerId)?.name} wins! 🏆</p>
              <div className="bg-players">{standings.map((p) => <Avatar key={p.id} p={p} points={p.points} />)}</div>
            </div>
          )}
        </>
      )}

      <div className="bg-controls">
        {g.phase !== 'lobby' && <button className="bg-mini" onClick={() => { if (confirm('Start the whole game over?')) restart(); }}>↺ Restart</button>}
      </div>
    </div>
  );
}

function fmtHand(h: Partial<Hand>) {
  const parts = (Object.keys(h) as Resource[]).filter((r) => h[r]).map((r) => `${h[r]} ${RESOURCE_ICON[r]} ${RESOURCE_NAME[r]}`);
  return parts.length ? parts.join(' + ') : 'nothing';
}

function Tiles({ g, onPick }: { g: Game; onPick?: (tileId: number) => void }) {
  const b = boardFor(g.boardId);
  return (
    <div className="bg-tiles">
      {b.tiles.map((t) => {
        const settlers = g.buildings.filter((x) => x.tileId === t.id);
        const full = settlers.length >= 2;
        const pickable = !!onPick && !full;
        return (
          <div key={t.id} className={`bg-tile bg-${t.resource} ${pickable ? 'bg-pickable' : ''} ${full ? 'bg-full' : ''}`}
            onClick={pickable ? () => onPick!(t.id) : undefined}>
            <span className="bg-tile-icon">{RESOURCE_ICON[t.resource]}</span>
            <span className="bg-tile-num">{t.number}</span>
            <span className="bg-tile-label">{t.label}</span>
            <div className="bg-tile-settlers">
              {settlers.map((s) => {
                const p = g.players.find((x) => x.id === s.playerId);
                if (!p) return null;
                return <span key={s.playerId} className={`bg-settler ${s.level === 2 ? 'bg-temple' : ''}`}>
                  <Pet species={p.species as SpeciesId} variant={p.color} mood="content" stage="grown" size={22} animate={false} />
                </span>;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Avatar({ p, points }: { p: { name: string; species: string; color: number }; points?: number }) {
  return (
    <div className="bg-av">
      <Pet species={p.species as SpeciesId} variant={p.color} mood="content" stage="grown" size={90} animate={false} />
      <span>{p.name}{points !== undefined ? ` · ${points}pt` : ''}</span>
    </div>
  );
}
