import { useEffect, useRef, useState } from 'react';
import { Navigate, Link } from 'react-router';
import { supabase } from '../../lib/supabase';
import { syncPet } from '../../lib/api';
import { useSession, isStudentEmail } from '../../lib/useSession';
import Pet from '../../pet/Pet';
import type { SpeciesId } from '../../domain/species';
import { ROUNDS, MAX_ANSWER } from '../../gameshow/rounds';
import type { Player } from '../../gameshow/engine';
import { openWire, type StateMsg, type Wire } from '../../gameshow/channel';
import '../../gameshow/gameshow.css';

interface Me extends Player { classId: string }

export default function GameShowPhone() {
  const session = useSession();
  const demo = import.meta.env.DEV ? new URLSearchParams(location.search).get('demo') : null;
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  useEffect(() => {
    if (demo || !session || !isStudentEmail(session.user.email)) return;
    (async () => {
      const [{ data: st }, app] = await Promise.all([
        supabase.from('students').select('class_id,display_name').eq('id', session.user.id).maybeSingle(),
        syncPet().catch(() => null),
      ]);
      if (!st) return setMe(null);
      setMe({ id: session.user.id, name: st.display_name, species: app?.pet?.species ?? 'fox', color: app?.pet?.colorVariant ?? 0, classId: st.class_id });
    })().catch(() => setMe(null));
  }, [session]);

  // Dev-only rehearsal: /gameshow?demo=Ana,fox,2
  if (demo) { const [name, species = 'fox', color = '0'] = demo.split(','); return <Play me={{ id: `demo-${name}`, name, species, color: +color, classId: 'demo' }} />; }
  if (session === undefined) return null;
  if (!session || !isStudentEmail(session.user.email)) return <Navigate to="/" replace />;
  if (me === undefined) return <main className="center"><p className="sub" style={{ marginTop: '30vh' }}>Joining the show…</p></main>;
  if (me === null) return <main className="center"><p className="sub">Couldn't find your class.</p><Link to="/home">Back</Link></main>;
  return <Play me={me} />;
}

function Play({ me }: { me: Me }) {
  const [st, setSt] = useState<StateMsg | null>(null);
  const [gotAt, setGotAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [text, setText] = useState('');
  const [sent, setSent] = useState<{ round: number; text: string } | null>(null);
  const [voted, setVoted] = useState<{ round: number; aid: string } | null>(null);
  const wire = useRef<Wire | null>(null);
  const roundNo = st?.round;
  useEffect(() => { setText(''); }, [roundNo]);

  useEffect(() => {
    const hello = () => wire.current?.sendToHost({ t: 'hello', p: { id: me.id, name: me.name, species: me.species, color: me.color } });
    const w = openWire(me.classId, () => {}, (m) => { setSt(m); setGotAt(Date.now()); }, hello);
    wire.current = w;
    const again = () => { if (!document.hidden) hello(); };
    document.addEventListener('visibilitychange', again);
    const hb = setInterval(hello, 6000); // lets the host re-add us if the laptop was reloaded
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => { clearInterval(hb); clearInterval(tick); document.removeEventListener('visibilitychange', again); w.close(); };
  }, [me]);

  const round = st ? ROUNDS[st.round] : null;
  const left = st?.left != null ? Math.max(0, st.left - Math.floor((now - gotAt) / 1000)) : null;
  const mySent = sent && st && sent.round === st.round ? sent : null;
  const myVote = voted && st && voted.round === st.round ? voted : null;
  const hostHasMine = !!st?.players.find((p) => p.id === me.id)?.done;

  function send() {
    const t = text.trim();
    if (!t || !st) return;
    wire.current?.sendToHost({ t: 'answer', id: me.id, text: t });
    setSent({ round: st.round, text: t });
  }
  function vote(aid: string) {
    if (!st) return;
    wire.current?.sendToHost({ t: 'vote', id: me.id, aid });
    setVoted({ round: st.round, aid });
  }

  return (
    <div className="gs gs-phone">
      <div className="gs-logo small">GOSPEL <i>GAME SHOW</i></div>
      <div style={{ textAlign: 'center' }}><Pet species={me.species as SpeciesId} variant={me.color} mood="thriving" stage="grown" size={st?.phase === 'lobby' || !st ? 140 : 64} /></div>
      {!st && <p className="gs-sub">Waiting for the show to start…</p>}

      {st?.phase === 'lobby' && <><p className="gs-big small">You're in, {me.name}!</p><p className="gs-sub">Look at the TV. The show starts soon.</p></>}

      {st && round && st.phase === 'intro' && <>
        <div className="gs-tag">{round.fun ? 'BONUS · ' : ''}ROUND {st.round + 1} · {round.title.toUpperCase()}</div>
        <p className="gs-setup small">{round.setup}</p><p className="gs-ask small">{round.ask}</p>
        <p className="gs-sub">Listen to the announcer. Typing opens in a moment.</p></>}

      {st && round && st.phase === 'writing' && <>
        <div className="gs-tag">{round.fun ? 'BONUS · ' : ''}ROUND {st.round + 1} · {round.title.toUpperCase()}</div>
        <p className="gs-setup small">{round.setup}</p><p className="gs-ask small">{round.ask}</p>
        <textarea className="gs-field" maxLength={MAX_ANSWER} rows={4} placeholder="Type your own answer…" value={text}
          onChange={(e) => setText(e.target.value)} />
        <div className="gs-count">{text.length}/{MAX_ANSWER}{left !== null ? ` · ${left}s` : ''}</div>
        <button className="gs-send" disabled={!text.trim()} onClick={send}>{mySent || hostHasMine ? 'UPDATE IT' : 'SEND IT!'}</button>
        {(mySent || hostHasMine) && <p className="gs-sub">Sent! You can still change it until time's up.</p>}
      </>}

      {st && round && st.phase === 'voting' && <>
        <p className="gs-ask small">{round.ask}</p>
        <p className="gs-sub">{round.vote}</p>
        {left !== null && <div className="gs-count">{left}s</div>}
        <div className="gs-opts">
          {st.answers.filter((a) => a.owner !== me.id).map((a) => (
            <button key={a.aid} className={`gs-opt ${myVote?.aid === a.aid ? 'on' : ''}`} onClick={() => vote(a.aid)}>{a.text}</button>
          ))}
        </div>
        {st.answers.every((a) => a.owner === me.id) && <p className="gs-sub">Nothing to vote on this round.</p>}
        {myVote && <p className="gs-sub">Vote is in. You can change it until time's up.</p>}
      </>}

      {st?.phase === 'reveal' && <><p className="gs-big small">Look at the TV!</p><p className="gs-sub">Names and votes are up.</p></>}
      {st?.phase === 'finale' && <><p className="gs-big small">That's the show!</p><p className="gs-sub">Thanks for being honest tonight.</p><Link to="/home"><button className="gs-send">Back to your pet</button></Link></>}
    </div>
  );
}
