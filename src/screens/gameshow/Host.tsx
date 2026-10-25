import { useEffect, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { supabase } from '../../lib/supabase';
import { useSession, isStudentEmail } from '../../lib/useSession';
import Pet from '../../pet/Pet';
import type { SpeciesId } from '../../domain/species';
import { ROUNDS, WRITE_SECS, VOTE_SECS } from '../../gameshow/rounds';
import {
  newShow, addPlayer, advance, submitAnswer, castVote, removeAnswer, toPublic, everyoneDone, type Show, type Step,
} from '../../gameshow/engine';
import { openWire, type Wire } from '../../gameshow/channel';
import { Announcer } from '../../gameshow/announcer';
import '../../gameshow/gameshow.css';

const SECS = { write: WRITE_SECS, vote: VOTE_SECS };
const GRACE_MS = 2500;
const key = (classId: string) => `gs-host-${classId}`;
function load(classId: string): Show {
  try { const r = localStorage.getItem(key(classId)); if (r) return JSON.parse(r) as Show; } catch { /* fresh show */ }
  return newShow();
}
let counter = 0;
const newId = () => `${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export default function GameShowHost() {
  const session = useSession();
  const [params] = useSearchParams();
  const [cls, setCls] = useState<{ id: string; name: string; join_code: string } | null | undefined>(undefined);
  useEffect(() => {
    if (!session) return;
    const q = supabase.from('classes').select('id,name,join_code').order('created_at');
    const want = params.get('class');
    (want ? q.eq('id', want) : q).then(({ data }) => setCls(data?.[0] ?? null));
  }, [session, params]);
  // Dev-only rehearsal without signing in (stripped from production builds).
  if (import.meta.env.DEV && params.get('demo')) return <Stage classId="demo" code="DEMO" />;
  if (session === undefined) return null;
  if (!session || isStudentEmail(session.user.email)) return <Navigate to="/teacher/login" replace />;
  if (cls === undefined) return <main className="center"><p className="sub">Loading…</p></main>;
  if (cls === null) return <main className="center"><p className="sub">No class found.</p></main>;
  return <Stage classId={cls.id} code={cls.join_code} />;
}

function Stage({ classId, code }: { classId: string; code: string }) {
  const [show, setShow] = useState<Show>(() => load(classId));
  const ref = useRef(show);
  const wire = useRef<Wire | null>(null);
  const ann = useRef(new Announcer());
  const [now, setNow] = useState(Date.now());
  const [muted, setMuted] = useState(false);
  const doneSince = useRef<number | null>(null);
  const hurried = useRef('');

  const publish = () => {
    const s = ref.current;
    wire.current?.sendState({ ...toPublic(s), left: s.endsAt ? Math.max(0, Math.round((s.endsAt - Date.now()) / 1000)) : null });
  };
  const update = (f: (s: Show) => Show) => {
    const n = f(ref.current);
    if (n === ref.current) return;
    ref.current = n; setShow(n);
    try { localStorage.setItem(key(classId), JSON.stringify(n)); } catch { /* storage full or blocked */ }
    publish();
  };

  /** Move the show forward and play whatever the announcer says for the new moment. */
  const go = (step: Step) => {
    const before = ref.current;
    update((s) => advance(s, step, Date.now(), SECS));
    const s = ref.current;
    if (s === before) return;
    const r = s.round + 1;
    if (step === 'start') ann.current.say(['welcome', `r${r}`], () => introDone(s.round));
    else if (step === 'next') s.phase === 'finale' ? ann.current.say('finale') : ann.current.say(`r${r}`, () => introDone(s.round));
    else if (before.phase === 'intro') ann.current.say('write');
    else if (s.phase === 'voting') ann.current.say('vote');
    else if (s.phase === 'reveal') ann.current.say('reveal');
  };
  const introDone = (round: number) => { const s = ref.current; if (s.phase === 'intro' && s.round === round) go('closeWriting'); };

  useEffect(() => {
    const w = openWire(classId, (m) => {
      if (m.t === 'hello') update((s) => addPlayer(s, m.p));
      else if (m.t === 'answer') update((s) => submitAnswer(s, m.id, m.text, newId));
      else if (m.t === 'vote') update((s) => castVote(s, m.id, m.aid));
      if (m.t === 'hello') publish();
    }, () => {}, publish);
    wire.current = w;
    const beat = setInterval(publish, 3000);
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => { clearInterval(beat); clearInterval(tick); w.close(); ann.current.stop(); };
  }, [classId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance: everyone in (after a short grace) or the clock runs out.
  useEffect(() => {
    const s = ref.current;
    if (s.phase !== 'writing' && s.phase !== 'voting') { doneSince.current = null; return; }
    const out = s.endsAt !== null && now >= s.endsAt;
    if (everyoneDone(s)) doneSince.current ??= now; else doneSince.current = null;
    const allIn = doneSince.current !== null && now - doneSince.current >= GRACE_MS;
    const left = s.endsAt ? Math.round((s.endsAt - now) / 1000) : null;
    const tag = `${s.phase}${s.round}`;
    if (left === 10 && hurried.current !== tag && !allIn) { hurried.current = tag; ann.current.say('hurry'); }
    if (out || allIn) { doneSince.current = null; go(s.phase === 'writing' ? 'closeWriting' : 'closeVoting'); }
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps

  const s = show;
  const round = ROUNDS[s.round];
  const pub = toPublic(s);
  const left = s.endsAt ? Math.max(0, Math.ceil((s.endsAt - now) / 1000)) : null;
  const top = Math.max(0, ...pub.answers.map((a) => a.votes ?? 0));

  const next: { label: string; step: Step } | null =
    s.phase === 'lobby' ? { label: 'Start the show', step: 'start' }
    : s.phase === 'intro' ? { label: 'Start typing now', step: 'closeWriting' }
    : s.phase === 'writing' ? { label: 'Close answers', step: 'closeWriting' }
    : s.phase === 'voting' ? { label: 'Show results', step: 'closeVoting' }
    : s.phase === 'reveal' ? { label: s.round === ROUNDS.length - 1 ? 'Finish' : 'Next round', step: 'next' }
    : null;

  return (
    <div className="gs gs-tv">
      <div className="gs-logo">GOSPEL <i>GAME SHOW</i></div>
      {left !== null && (s.phase === 'writing' || s.phase === 'voting') && <div className={`gs-timer ${left <= 10 ? 'low' : ''}`}>{left}</div>}

      {s.phase === 'lobby' && (
        <div className="gs-center">
          <p className="gs-big">Grab your phone</p>
          <p className="gs-sub">Open Tend, sign in, and tap <b>Game Show</b> on your home screen.</p>
          <p className="gs-sub">Class code <b className="gs-code">{code}</b></p>
          <div className="gs-players">
            {s.players.length === 0 && <span className="gs-sub">Waiting for players…</span>}
            {s.players.map((p) => <Avatar key={p.id} p={p} />)}
          </div>
        </div>
      )}

      {(s.phase === 'intro' || s.phase === 'writing') && (
        <div className="gs-center">
          <div className="gs-tag">ROUND {s.round + 1} OF {ROUNDS.length} · {round.title.toUpperCase()}</div>
          <p className="gs-setup">{round.setup}</p>
          <p className="gs-ask">{round.ask}</p>
          {s.phase === 'writing' && <p className="gs-sub">{pub.doneCount} of {s.players.length} answers in. Type on your phone.</p>}
        </div>
      )}

      {s.phase === 'voting' && (
        <div className="gs-center">
          <p className="gs-ask small">{round.ask}</p>
          <p className="gs-sub">{round.vote} {pub.doneCount} of {s.players.length} have voted.</p>
          <div className="gs-board">
            {pub.answers.map((a) => (
              <div key={a.aid} className="gs-bub">{a.text}
                <button className="gs-x" title="Remove this answer" onClick={() => update((x) => removeAnswer(x, a.aid))}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {s.phase === 'reveal' && (
        <div className="gs-center">
          <p className="gs-ask small">{round.ask}</p>
          {pub.answers.length === 0 && <p className="gs-sub">No answers this round.</p>}
          <div className="gs-board">
            {pub.answers.map((a) => (
              <div key={a.aid} className={`gs-bub ${top > 0 && a.votes === top ? 'win' : ''}`}>
                {top > 0 && <span className="gs-pct">{a.votes} {a.votes === 1 ? 'vote' : 'votes'}</span>}
                {a.text}<small>{a.by}</small>
              </div>
            ))}
          </div>
          {round.lens && <p className="gs-lens">“{round.lens.text}” <b>{round.lens.ref}</b></p>}
        </div>
      )}

      {s.phase === 'finale' && (
        <div className="gs-center">
          <p className="gs-big">That's the show!</p>
          <p className="gs-sub">Thanks for being honest tonight.</p>
          <div className="gs-players">{s.players.map((p) => <Avatar key={p.id} p={p} />)}</div>
        </div>
      )}

      {s.phase !== 'lobby' && s.phase !== 'finale' && (
        <div className="gs-players bottom">{pub.players.map((p) => <Avatar key={p.id} p={p} done={p.done} small />)}</div>
      )}

      <div className="gs-controls">
        <button className="gs-mini" onClick={() => { ann.current.muted = !muted; setMuted(!muted); if (!muted) ann.current.stop(); }}>{muted ? '🔇 Sound off' : '🔊 Sound on'}</button>
        {next && <button className={`gs-go ${s.phase === 'lobby' || s.phase === 'reveal' ? 'main' : ''}`} onClick={() => go(next.step)}>{next.label} ▸</button>}
        {s.phase !== 'lobby' && <button className="gs-mini" onClick={() => { if (confirm('Start the whole show over?')) { ann.current.stop(); update(() => ({ ...newShow(), players: ref.current.players })); } }}>↺ Restart</button>}
      </div>
    </div>
  );
}

function Avatar({ p, done, small }: { p: { name: string; species: string; color: number }; done?: boolean; small?: boolean }) {
  return (
    <div className={`gs-av ${done ? 'done' : ''} ${small ? 'small' : ''}`}>
      <Pet species={p.species as SpeciesId} variant={p.color} mood="content" stage="grown" size={small ? 54 : 96} animate={false} />
      <span>{p.name}</span>
    </div>
  );
}
