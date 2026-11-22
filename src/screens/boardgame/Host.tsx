import { useEffect, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { supabase } from '../../lib/supabase';
import { useSession, isStudentEmail } from '../../lib/useSession';
import Pet from '../../pet/Pet';
import Confetti from '../../pet/Confetti';
import type { SpeciesId } from '../../domain/species';
import { deckFor } from '../../boardgame/board';
import {
  newGame, addPlayer, start, play, closePlays, pick, next, removePlayer, judgeId, toPublic, MIN_PLAYERS, type Game,
} from '../../boardgame/engine';
import { openWire, type Wire } from '../../boardgame/channel';
import { sfxPlay, sfxFlip, sfxWin, sfxChampion } from '../../boardgame/sfx';
import '../../boardgame/boardgame.css';

const key = (classId: string) => `bg-host-${classId}`;
function load(classId: string, deckId: string): Game {
  try {
    const r = localStorage.getItem(key(classId));
    if (r) { const g = JSON.parse(r) as Game; if (g.deckId === deckId && Array.isArray(g.redDeck)) return g; }
  } catch { /* fresh game */ }
  return newGame(deckId);
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
  const d = deckFor();
  const [game, setGame] = useState<Game>(() => load(classId, d.id));
  const ref = useRef(game);
  const wire = useRef<Wire | null>(null);
  const [burst, setBurst] = useState(0);

  const publish = () => wire.current?.sendState(toPublic(ref.current));
  const update = (f: (g: Game) => Game) => {
    const before = ref.current;
    const n = f(before);
    if (n === before) return;
    ref.current = n; setGame(n);
    try { localStorage.setItem(key(classId), JSON.stringify(n)); } catch { /* storage full or blocked */ }
    publish();
    if (before.phase === 'playing' && n.phase === 'judging') sfxFlip();
    else if (n.phase === 'reveal' && before.phase !== 'reveal') { sfxWin(); setBurst((x) => x + 1); }
    else if (n.phase === 'finished' && before.phase !== 'finished') { sfxChampion(); setBurst((x) => x + 1); }
    else if (n.plays.length > before.plays.length) sfxPlay();
  };

  useEffect(() => {
    const w = openWire(classId, (m) => {
      if (m.t === 'hello') update((g) => addPlayer(g, m.p));
      else if (m.t === 'play') update((g) => play(g, m.id, m.card));
      else if (m.t === 'pick') update((g) => pick(g, m.id, m.card));
      else if (m.t === 'next') update((g) => (m.id === judgeId(g) || g.winner?.by === m.id ? next(g) : g));
      if (m.t === 'hello') publish();
    }, () => {}, publish);
    wire.current = w;
    const beat = setInterval(publish, 3000);
    return () => { clearInterval(beat); w.close(); };
  }, [classId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the laptop awake while the game is on the TV.
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
  const judge = pub.players.find((p) => p.id === pub.judgeId);
  const nameOf = (id: string | null) => pub.players.find((p) => p.id === id)?.name ?? '?';
  const waitingOn = pub.players.filter((p) => p.id !== pub.judgeId && !p.played);
  const champ = pub.players.find((p) => p.id === pub.winnerId);
  const greenCard = pub.green && (
    <div className="bg-green"><small>{judge ? `${judge.name.toUpperCase()} IS JUDGING` : 'THE WORD IS'}</small><b>{pub.green.word}</b></div>
  );

  return (
    <div className="bg bg-tv">
      {burst > 0 && <Confetti key={burst} />}
      <div className="bg-logo">{d.title.toUpperCase()}</div>
      <p className="bg-sub">Class code <b className="bg-code">{code}</b> · open Tend and tap <b>Harvest Picks</b></p>

      {g.phase === 'lobby' && (
        <div className="bg-center">
          <p className="bg-big">Grab your phone</p>
          <p className="bg-sub">Each round one person judges a word. Everyone else plays the card from their hand that fits it best.
            The judge picks a favorite. First to {pub.winTarget} words wins.</p>
          <div className="bg-players">
            {g.players.length === 0 && <span className="bg-sub">Waiting for players…</span>}
            {g.players.map((p) => <Avatar key={p.id} p={p} />)}
          </div>
          <button className="bg-go main" onClick={() => update((x) => start(x))} disabled={g.players.length < MIN_PLAYERS}>
            {g.players.length < MIN_PLAYERS ? `Need ${MIN_PLAYERS - g.players.length} more` : 'Deal the cards ▸'}
          </button>
        </div>
      )}

      {g.phase === 'playing' && (
        <div className="bg-center">
          {greenCard}
          <p className="bg-sub">Pick the card from your hand that's most <b>{pub.green?.word.toLowerCase()}</b>.</p>
          <div className="bg-reds">{pub.players.filter((p) => p.played).map((p) => <div key={p.id} className="bg-facedown" />)}</div>
          <p className="bg-sub">{waitingOn.length === 0 ? 'Everyone is in!' : `Waiting on ${waitingOn.map((p) => p.name).join(', ')}`}</p>
        </div>
      )}

      {g.phase === 'judging' && (
        <div className="bg-center">
          {greenCard}
          <p className="bg-sub">{judge?.name}, read each card out loud, then pick your favorite on your phone.</p>
          <div className="bg-reds flip">
            {pub.plays.map((c) => (
              <div key={c.card} className="bg-red pickable" title="Pick for the judge"
                onClick={() => update((x) => pick(x, judgeId(x) ?? '', c.card))}>{c.text}</div>
            ))}
          </div>
        </div>
      )}

      {(g.phase === 'reveal' || g.phase === 'finished') && pub.winner && (
        <div className="bg-center">
          <div className="bg-green small"><b>{pub.green?.word}</b></div>
          {g.phase === 'finished' && champ
            ? <p className="bg-big">{champ.name} wins the game! 🏆</p>
            : <p className="bg-big">{nameOf(pub.winner.by)} gets it!</p>}
          <div className="bg-reds">
            {pub.plays.map((c) => (
              <div key={c.card} className={`bg-red ${c.card === pub.winner!.card ? 'win' : 'dim'}`}>{c.text}<small>{nameOf(c.by)}</small></div>
            ))}
          </div>
          {pub.green?.lens && <p className="bg-lens">“{pub.green.lens.text}”<b>{pub.green.lens.ref}</b></p>}
        </div>
      )}

      {g.phase !== 'lobby' && (
        <div className="bg-players bottom">
          {pub.players.map((p) => (
            <Avatar key={p.id} p={p} small score={p.greens.length} judge={p.id === pub.judgeId}
              done={g.phase === 'playing' && p.played} onRemove={() => { if (confirm(`Take ${p.name} out of the game?`)) update((x) => removePlayer(x, p.id)); }} />
          ))}
        </div>
      )}

      <div className="bg-controls">
        {g.phase === 'playing' && g.plays.length > 0 && waitingOn.length > 0 &&
          <button className="bg-go" onClick={() => update((x) => closePlays(x))}>Flip cards now ▸</button>}
        {g.phase === 'reveal' && <button className="bg-go main" onClick={() => update((x) => next(x))}>Next round ▸</button>}
        {g.phase === 'finished' && <button className="bg-go main" onClick={() => update((x) => start(x))}>Play again ▸</button>}
        {g.phase !== 'lobby' && <button className="bg-mini" onClick={() => { if (confirm('Start over from the lobby?')) update((x) => ({ ...newGame(d.id), players: x.players.map((p) => ({ ...p, hand: [], greens: [] })) })); }}>↺ Restart</button>}
      </div>
    </div>
  );
}

function Avatar({ p, small, score, judge, done, onRemove }: {
  p: { name: string; species: string; color: number }; small?: boolean; score?: number; judge?: boolean; done?: boolean; onRemove?: () => void;
}) {
  return (
    <div className={`bg-av ${small ? 'small' : ''} ${judge ? 'judge' : ''} ${done ? 'done' : ''}`} onDoubleClick={onRemove}>
      {judge && <span className="bg-gavel">⚖️</span>}
      {score !== undefined && score > 0 && <span className="bg-score">{score}</span>}
      <Pet species={p.species as SpeciesId} variant={p.color} mood="content" stage="grown" size={small ? 48 : 90} animate={false} />
      <span>{p.name}</span>
    </div>
  );
}
