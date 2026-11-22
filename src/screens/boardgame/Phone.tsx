import { useEffect, useRef, useState } from 'react';
import { Navigate, Link } from 'react-router';
import { supabase } from '../../lib/supabase';
import { syncPet } from '../../lib/api';
import { useSession, isStudentEmail } from '../../lib/useSession';
import Pet from '../../pet/Pet';
import type { SpeciesId } from '../../domain/species';
import { openWire, type PublicState, type Wire } from '../../boardgame/channel';
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
      setMe({ id: session.user.id, name: app?.pet?.name ?? st.display_name, species: app?.pet?.species ?? 'fox', color: app?.pet?.colorVariant ?? 0, classId: st.class_id });
    })().catch(() => setMe(null));
  }, [session]);

  if (demo) { const [name, species = 'fox', color = '0'] = demo.split(','); return <Play me={{ id: `demo-${name}`, name, species, color: +color, classId: 'demo' }} />; }
  if (session === undefined) return null;
  if (!session || !isStudentEmail(session.user.email)) return <Navigate to="/" replace />;
  if (me === undefined) return <main className="center"><p className="sub" style={{ marginTop: '30vh' }}>Joining the game…</p></main>;
  if (me === null) return <main className="center"><p className="sub">Couldn't find your class.</p><Link to="/home">Back</Link></main>;
  return <Play me={me} />;
}

function Play({ me }: { me: Me }) {
  const [st, setSt] = useState<PublicState | null>(null);
  const wire = useRef<Wire | null>(null);

  useEffect(() => {
    const hello = () => wire.current?.sendToHost({ t: 'hello', p: { id: me.id, name: me.name, species: me.species, color: me.color } });
    const w = openWire(me.classId, () => {}, setSt, hello);
    wire.current = w;
    const again = () => { if (!document.hidden) hello(); };
    document.addEventListener('visibilitychange', again);
    const hb = setInterval(hello, 6000);
    return () => { clearInterval(hb); document.removeEventListener('visibilitychange', again); w.close(); };
  }, [me]);

  const myTurn = st?.currentId === me.id;
  const roll = () => wire.current?.sendToHost({ t: 'roll', id: me.id });

  return (
    <div className="bg bg-phone">
      <div className="bg-logo small">{st?.title.toUpperCase() ?? 'THE ROAD BACK HOME'}</div>
      <div style={{ textAlign: 'center' }}><Pet species={me.species as SpeciesId} variant={me.color} mood="thriving" stage="grown" size={st && st.phase !== 'lobby' ? 70 : 140} /></div>

      {!st && <p className="bg-sub">Waiting for the game to start…</p>}
      {st?.phase === 'lobby' && <><p className="bg-big small">You're in, {me.name}!</p><p className="bg-sub">Look at the screen. The game starts soon.</p></>}

      {st && st.phase === 'playing' && !st.pending && (
        myTurn
          ? <button className="bg-send" onClick={roll}>🎲 ROLL!</button>
          : <p className="bg-sub">Waiting on {st.players.find((p) => p.id === st.currentId)?.name ?? 'someone'}…</p>
      )}

      {st?.pending && (
        <div className="bg-card">
          <p className="bg-tag">{st.pending.prompt}</p>
          {st.pending.q && <p className="bg-ask small">{st.pending.q}</p>}
          <p className="bg-sub">Look at the screen up front.</p>
        </div>
      )}

      {st?.phase === 'finished' && <><p className="bg-big small">Everybody's home! 🏡</p><Link to="/home"><button className="bg-send">Back to your pet</button></Link></>}
    </div>
  );
}
