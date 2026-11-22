import { useEffect, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { supabase } from '../../lib/supabase';
import { useSession, isStudentEmail } from '../../lib/useSession';
import Pet from '../../pet/Pet';
import Confetti from '../../pet/Confetti';
import type { SpeciesId } from '../../domain/species';
import { boardFor, spaceType, HOME_INDEX, snakeOrder, type SpaceType } from '../../boardgame/board';
import { newGame, addPlayer, start, roll, resolvePending, toPublic, type Game, type Player } from '../../boardgame/engine';
import { openWire, type Wire } from '../../boardgame/channel';
import { sfxDiceRoll, sfxGood, sfxWander, sfxHome } from '../../boardgame/sfx';
import '../../boardgame/boardgame.css';

const key = (classId: string) => `bg-host-${classId}`;
function load(classId: string, boardId: string): Game {
  try { const r = localStorage.getItem(key(classId)); if (r) { const g = JSON.parse(r) as Game; if (g.boardId === boardId) return g; } } catch { /* fresh game */ }
  return newGame(boardId);
}

const SPACE_LABEL: Record<SpaceType, string> = {
  plain: '', thankful: '🦃', scripture: '📖', wander: '🧭', grace: '🕊️', share: '💬', home: '🏡',
};
const STEP_MS = 160;
const MEDALS = ['🥇', '🥈', '🥉'];

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
  const home = HOME_INDEX(b);
  const [game, setGame] = useState<Game>(() => load(classId, b.id));
  const ref = useRef(game);
  const wire = useRef<Wire | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Purely cosmetic: hops the roller's token across the board before the real state lands.
  const [anim, setAnim] = useState<{ id: string; pos: number } | null>(null);
  const [rollingFor, setRollingFor] = useState<string | null>(null);
  const [burst, setBurst] = useState(0); // bump to retrigger confetti

  const publish = () => wire.current?.sendState(toPublic(ref.current));
  const update = (f: (g: Game) => Game) => {
    const n = f(ref.current);
    if (n === ref.current) return;
    ref.current = n; setGame(n);
    try { localStorage.setItem(key(classId), JSON.stringify(n)); } catch { /* storage full or blocked */ }
    publish();
  };

  const commitRoll = (id: string, die: number) => {
    const before = ref.current;
    update((g) => roll(g, id, die));
    const after = ref.current;
    if (after.finishedOrder.length > before.finishedOrder.length) { sfxHome(); setBurst((n) => n + 1); }
    else if (after.pending?.kind === 'wander') sfxWander();
    else if (after.pending) { sfxGood(); setBurst((n) => n + 1); }
  };

  const doRoll = (id: string) => {
    if (anim || rollingFor) return;
    const g0 = ref.current;
    const player = g0.players.find((p) => p.id === id);
    if (!player || g0.pending || toPublic(g0).currentId !== id) return;
    const die = 1 + Math.floor(Math.random() * 6);
    const path = Array.from({ length: die }, (_, s) => Math.min(player.pos + s + 1, home));
    sfxDiceRoll(die);
    setRollingFor(id);
    let i = 0;
    const step = () => {
      setAnim({ id, pos: path[i] });
      i++;
      timer.current = setTimeout(i < path.length ? step : () => {
        setAnim(null); setRollingFor(null); commitRoll(id, die);
      }, STEP_MS);
    };
    step();
  };
  const restart = () => update(() => newGame(b.id));

  useEffect(() => {
    const w = openWire(classId, (m) => {
      if (m.t === 'hello') update((g) => addPlayer(g, m.p));
      else if (m.t === 'roll') doRoll(m.id);
    }, () => {}, publish);
    wire.current = w;
    const beat = setInterval(publish, 3000);
    return () => { clearInterval(beat); w.close(); if (timer.current) clearTimeout(timer.current); };
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
  const cells = snakeOrder(home + 1, 6); // 0..home, in zigzag reading order
  const posFor = (p: Player) => (anim && anim.id === p.id ? anim.pos : p.pos);
  const standings = [...g.players].sort((x, y) => posFor(y) - posFor(x));

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
          <div className="bg-board">
            {cells.map((i) => {
              const type = spaceType(b, i);
              const here = g.players.filter((p) => posFor(p) === i);
              return (
                <div key={i} className={`bg-cell bg-${type} ${here.length ? 'bg-occupied' : ''}`}>
                  <span className="bg-icon">{SPACE_LABEL[type]}</span>
                  <div className="bg-tokens">{here.map((p) => <Token key={p.id} p={p} hopping={anim?.id === p.id} />)}</div>
                </div>
              );
            })}
          </div>

          <div className="bg-standings">
            {standings.map((p, i) => (
              <div key={p.id} className={`bg-stand-row ${p.id === pub.currentId ? 'current' : ''}`}>
                <span className="bg-stand-rank">{i === 0 && posFor(p) > 0 ? '👑' : ''}</span>
                <Pet species={p.species as SpeciesId} variant={p.color} mood="content" stage="grown" size={26} animate={false} />
                <span className="bg-stand-name">{p.name}</span>
                <div className="bg-stand-bar"><div className="bg-stand-fill" style={{ width: `${Math.min(100, (posFor(p) / home) * 100)}%` }} /></div>
              </div>
            ))}
          </div>

          {!pub.pending && pub.phase === 'playing' && currentPlayer && (
            <div className="bg-turn">
              <p className="bg-big">{currentPlayer.name}'s turn</p>
              <button className={`bg-die ${rollingFor ? 'spin' : ''}`} onClick={() => doRoll(currentPlayer.id)} disabled={!!rollingFor}>
                {rollingFor ? '🎲' : pub.lastDie !== null ? pub.lastDie : '🎲'}
              </button>
              <p className="bg-sub">Tap to roll for {currentPlayer.name} — or they roll from their own phone</p>
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
              <div className="bg-players">
                {g.finishedOrder.map((id, i) => {
                  const p = g.players.find((x) => x.id === id)!;
                  return <Avatar key={id} p={p} medal={MEDALS[i]} />;
                })}
              </div>
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

function Avatar({ p, medal }: { p: { name: string; species: string; color: number }; medal?: string }) {
  return (
    <div className="bg-av">
      <Pet species={p.species as SpeciesId} variant={p.color} mood="content" stage="grown" size={90} animate={false} />
      <span>{medal ? `${medal} ` : ''}{p.name}</span>
    </div>
  );
}
function Token({ p, hopping }: { p: { name: string; species: string; color: number }; hopping?: boolean }) {
  return <span className={hopping ? 'bg-hop' : ''}><Pet species={p.species as SpeciesId} variant={p.color} mood="content" stage="grown" size={28} animate={false} /></span>;
}
