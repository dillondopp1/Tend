import { useEffect, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { supabase } from '../../lib/supabase';
import { useSession, isStudentEmail } from '../../lib/useSession';
import Pet from '../../pet/Pet';
import type { SpeciesId } from '../../domain/species';
import { boardFor, spaceType, HOME_INDEX, snakeOrder, type SpaceType } from '../../boardgame/board';
import { newGame, addPlayer, start, roll, resolvePending, toPublic, type Game } from '../../boardgame/engine';
import { openWire, type Wire } from '../../boardgame/channel';
import '../../boardgame/boardgame.css';

const key = (classId: string) => `bg-host-${classId}`;
function load(classId: string, boardId: string): Game {
  try { const r = localStorage.getItem(key(classId)); if (r) { const g = JSON.parse(r) as Game; if (g.boardId === boardId) return g; } } catch { /* fresh game */ }
  return newGame(boardId);
}

const SPACE_LABEL: Record<SpaceType, string> = {
  plain: '', thankful: '🦃', scripture: '📖', wander: '🧭', grace: '🕊️', share: '💬', home: '🏡',
};

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

  const publish = () => wire.current?.sendState(toPublic(ref.current));
  const update = (f: (g: Game) => Game) => {
    const n = f(ref.current);
    if (n === ref.current) return;
    ref.current = n; setGame(n);
    try { localStorage.setItem(key(classId), JSON.stringify(n)); } catch { /* storage full or blocked */ }
    publish();
  };

  const doRoll = (id: string) => update((g) => roll(g, id, 1 + Math.floor(Math.random() * 6)));
  const restart = () => update(() => newGame(b.id));

  useEffect(() => {
    const w = openWire(classId, (m) => {
      if (m.t === 'hello') update((g) => addPlayer(g, m.p));
      else if (m.t === 'roll') doRoll(m.id);
    }, () => {}, publish);
    wire.current = w;
    const beat = setInterval(publish, 3000);
    return () => { clearInterval(beat); w.close(); };
  }, [classId]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const home = HOME_INDEX(b);
  const cells = snakeOrder(home + 1, 6); // 0..home, in zigzag reading order

  return (
    <div className="bg bg-tv">
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
          <div className="bg-board">
            {cells.map((i) => {
              const type = spaceType(b, i);
              const here = g.players.filter((p) => p.pos === i);
              return (
                <div key={i} className={`bg-cell bg-${type}`}>
                  <span className="bg-icon">{SPACE_LABEL[type]}</span>
                  <div className="bg-tokens">{here.map((p) => <Token key={p.id} p={p} />)}</div>
                </div>
              );
            })}
          </div>

          {!pub.pending && pub.phase === 'playing' && currentPlayer && (
            <div className="bg-turn">
              <p className="bg-big">{currentPlayer.name}'s turn</p>
              {pub.lastDie !== null && <p className="bg-sub">Last roll: 🎲 {pub.lastDie}</p>}
              <button className="bg-go main" onClick={() => doRoll(currentPlayer.id)}>Roll for {currentPlayer.name} 🎲</button>
              <p className="bg-sub">(or they roll from their own phone)</p>
            </div>
          )}

          {pub.pending && (
            <div className="bg-card">
              <p className="bg-tag">{pub.pending.prompt}</p>
              {pub.pending.q && <p className="bg-ask">{pub.pending.q}</p>}
              {pub.pending.a && <p className="bg-answer">{pub.pending.a}</p>}
              {pub.pending.kind === 'scripture' ? (
                <div className="bg-row">
                  <button className="bg-go main" onClick={() => update((x) => resolvePending(x, true))}>Got it! +3 ▸</button>
                  <button className="bg-go" onClick={() => update((x) => resolvePending(x, false))}>Keep going ▸</button>
                </div>
              ) : (
                <button className="bg-go main" onClick={() => update((x) => resolvePending(x, false))}>Continue ▸</button>
              )}
            </div>
          )}

          {g.phase === 'finished' && (
            <div className="bg-center">
              <p className="bg-big">Everybody's home! 🏡</p>
              <div className="bg-players">{g.players.map((p) => <Avatar key={p.id} p={p} />)}</div>
            </div>
          )}

          <div className="bg-players bottom">{g.players.map((p) => <Avatar key={p.id} p={p} small current={p.id === pub.currentId} />)}</div>
        </>
      )}

      <div className="bg-controls">
        {g.phase !== 'lobby' && <button className="bg-mini" onClick={() => { if (confirm('Start the whole game over?')) restart(); }}>↺ Restart</button>}
      </div>
    </div>
  );
}

function Avatar({ p, small, current }: { p: { name: string; species: string; color: number }; small?: boolean; current?: boolean }) {
  return (
    <div className={`bg-av ${small ? 'small' : ''} ${current ? 'current' : ''}`}>
      <Pet species={p.species as SpeciesId} variant={p.color} mood="content" stage="grown" size={small ? 48 : 90} animate={false} />
      <span>{p.name}</span>
    </div>
  );
}
function Token({ p }: { p: { name: string; species: string; color: number } }) {
  return <Pet species={p.species as SpeciesId} variant={p.color} mood="content" stage="grown" size={28} animate={false} />;
}
