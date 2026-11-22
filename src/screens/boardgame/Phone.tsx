import { useEffect, useRef, useState } from 'react';
import { Navigate, Link } from 'react-router';
import { supabase } from '../../lib/supabase';
import { syncPet } from '../../lib/api';
import { useSession, isStudentEmail } from '../../lib/useSession';
import Pet from '../../pet/Pet';
import type { SpeciesId } from '../../domain/species';
import type { PublicState } from '../../boardgame/engine';
import { openWire, type Wire } from '../../boardgame/channel';
import { sfxPlay } from '../../boardgame/sfx';
import '../../boardgame/boardgame.css';

interface Me { id: string; name: string; species: string; color: number; classId: string }

export default function BoardGamePhone() {
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
      // The class sees the animal's name, not the kid's own.
      setMe({ id: session.user.id, name: app?.pet?.name ?? st.display_name, species: app?.pet?.species ?? 'fox', color: app?.pet?.colorVariant ?? 0, classId: st.class_id });
    })().catch(() => setMe(null));
  }, [session]);

  // Dev-only rehearsal: /boardgame?demo=Ana,fox,2
  if (demo) { const [name, species = 'fox', color = '0'] = demo.split(','); return <Play me={{ id: `demo-${name}`, name, species, color: +color, classId: 'demo' }} />; }
  if (session === undefined) return null;
  if (!session || !isStudentEmail(session.user.email)) return <Navigate to="/" replace />;
  if (me === undefined) return <main className="center"><p className="sub" style={{ marginTop: '30vh' }}>Joining the game…</p></main>;
  if (me === null) return <main className="center"><p className="sub">Couldn't find your class.</p><Link to="/home">Back</Link></main>;
  return <Play me={me} />;
}

function Play({ me }: { me: Me }) {
  const [st, setSt] = useState<PublicState | null>(null);
  const [sent, setSent] = useState<number | null>(null);
  const wire = useRef<Wire | null>(null);

  useEffect(() => {
    const hello = () => wire.current?.sendToHost({ t: 'hello', p: { id: me.id, name: me.name, species: me.species, color: me.color } });
    const w = openWire(me.classId, () => {}, setSt, hello);
    wire.current = w;
    const again = () => { if (!document.hidden) hello(); };
    document.addEventListener('visibilitychange', again);
    const hb = setInterval(hello, 6000); // lets the host re-add us if the laptop was reloaded
    return () => { clearInterval(hb); document.removeEventListener('visibilitychange', again); w.close(); };
  }, [me]);

  const mine = st?.players.find((p) => p.id === me.id);
  const judging = st?.judgeId === me.id;
  const judgeName = st?.players.find((p) => p.id === st.judgeId)?.name ?? 'The judge';
  // Clear the "sent" marker once the host has our card or a new round starts.
  useEffect(() => { if (st?.phase !== 'playing' || mine?.played) setSent(null); }, [st?.phase, mine?.played]);

  const playCard = (card: number) => {
    if (sent !== null || mine?.played) return;
    sfxPlay(); setSent(card);
    wire.current?.sendToHost({ t: 'play', id: me.id, card });
  };
  const pickCard = (card: number) => wire.current?.sendToHost({ t: 'pick', id: me.id, card });
  const nameOf = (id: string | null) => st?.players.find((p) => p.id === id)?.name ?? '?';
  const green = st?.green && <div className="bg-green small"><b>{st.green.word}</b></div>;

  return (
    <div className="bg bg-phone">
      <div className="bg-logo small">{st?.title.toUpperCase() ?? 'HARVEST PICKS'}</div>
      <div style={{ textAlign: 'center' }}>
        <Pet species={me.species as SpeciesId} variant={me.color} mood="thriving" stage="grown" size={!st || st.phase === 'lobby' ? 130 : 56} />
        {mine && mine.greens.length > 0 && <p className="bg-sub">🍏 {mine.greens.length} of {st?.winTarget}: {mine.greens.join(', ')}</p>}
      </div>

      {!st && <p className="bg-sub">Waiting for the game to start…</p>}
      {st?.phase === 'lobby' && <><p className="bg-big small">You're in, {me.name}!</p><p className="bg-sub">Look at the TV. Cards get dealt soon.</p></>}

      {st?.phase === 'playing' && (judging ? <>
        <p className="bg-big small">You're the judge ⚖️</p>
        {green}
        <p className="bg-sub">Everyone is picking their card for this word. Get ready to read them out loud.</p>
      </> : <>
        {green}
        {mine?.played || sent !== null
          ? <p className="bg-sub">Card is in. Waiting on everybody else…</p>
          : <p className="bg-sub">Tap the card that's most <b>{st.green?.word.toLowerCase()}</b>.</p>}
        <div className="bg-reds">
          {mine?.hand.map((c) => (
            <button key={c.card} className={`bg-red ${mine.played || sent !== null ? 'dim' : 'pickable'}`}
              disabled={mine.played || sent !== null} onClick={() => playCard(c.card)}>{c.text}</button>
          ))}
        </div>
      </>)}

      {st?.phase === 'judging' && (judging ? <>
        <p className="bg-big small">Pick your favorite</p>
        {green}
        <p className="bg-sub">Read them all out loud first, then tap the winner.</p>
        <div className="bg-reds">
          {st.plays.map((c) => <button key={c.card} className="bg-red pickable" onClick={() => pickCard(c.card)}>{c.text}</button>)}
        </div>
      </> : <>
        {green}
        <p className="bg-sub">{judgeName} is reading the cards. Look at the TV.</p>
      </>)}

      {st?.phase === 'reveal' && st.winner && <>
        <p className="bg-big small">{st.winner.by === me.id ? 'You got it! 🍏' : `${nameOf(st.winner.by)} gets it`}</p>
        <div className="bg-reds"><div className="bg-red win">{st.winner.text}</div></div>
        {(judging || st.winner.by === me.id) && <button className="bg-send" onClick={() => wire.current?.sendToHost({ t: 'next', id: me.id })}>Next round ▸</button>}
      </>}

      {st?.phase === 'finished' && <>
        <p className="bg-big small">{st.winnerId === me.id ? 'You won the game! 🏆' : `${nameOf(st.winnerId)} won the game! 🏆`}</p>
        <Link to="/home"><button className="bg-send">Back to your pet</button></Link>
      </>}
    </div>
  );
}
