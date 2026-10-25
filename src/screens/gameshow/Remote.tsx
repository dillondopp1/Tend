import { useEffect, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { supabase } from '../../lib/supabase';
import { useSession, isStudentEmail } from '../../lib/useSession';
import { ROUNDS } from '../../gameshow/rounds';
import { openWire, type StateMsg, type Wire } from '../../gameshow/channel';
import '../../gameshow/gameshow.css';

const NEXT: Record<string, string> = {
  lobby: 'Start the show', intro: 'Start typing now', writing: 'Close answers', voting: 'Show results', reveal: 'Next round',
};

/** The teacher's phone as a remote for the laptop on the TV. Same channel, teacher sign-in required. */
export default function GameShowRemote() {
  const session = useSession();
  const [params] = useSearchParams();
  const [classId, setClassId] = useState<string | null | undefined>(undefined);
  const demo = import.meta.env.DEV && params.get('demo');
  useEffect(() => {
    if (!session || demo) return;
    const q = supabase.from('classes').select('id').order('created_at');
    const want = params.get('class');
    (want ? q.eq('id', want) : q).then(({ data }) => setClassId(data?.[0]?.id ?? null));
  }, [session, params, demo]);
  if (demo) return <Remote classId="demo" />;
  if (session === undefined) return null;
  if (!session || isStudentEmail(session.user.email)) return <Navigate to="/teacher/login" replace />;
  if (classId === undefined) return <main className="center"><p className="sub">Loading…</p></main>;
  if (classId === null) return <main className="center"><p className="sub">No class found.</p></main>;
  return <Remote classId={classId} />;
}

function Remote({ classId }: { classId: string }) {
  const [st, setSt] = useState<StateMsg | null>(null);
  const [gotAt, setGotAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const wire = useRef<Wire | null>(null);

  useEffect(() => {
    const ask = () => wire.current?.sendToHost({ t: 'remote' });
    const w = openWire(classId, () => {}, (m) => { setSt(m); setGotAt(Date.now()); }, ask);
    wire.current = w;
    const again = () => { if (!document.hidden) ask(); };
    document.addEventListener('visibilitychange', again);
    const hb = setInterval(ask, 5000);
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => { clearInterval(hb); clearInterval(tick); document.removeEventListener('visibilitychange', again); w.close(); };
  }, [classId]);

  const cmd = (c: 'next' | 'finish' | 'mute' | 'restart' | 'remove', aid?: string) => wire.current?.sendToHost({ t: 'cmd', cmd: c, aid });
  const round = st ? ROUNDS[st.round] : null;
  const left = st?.left != null ? Math.max(0, st.left - Math.floor((now - gotAt) / 1000)) : null;
  const stale = st ? now - gotAt > 9000 : false;

  return (
    <div className="gs gs-phone">
      <div className="gs-logo small">REMOTE</div>
      {!st && <p className="gs-sub">Looking for the show… Open the Game Show on your laptop first.</p>}
      {stale && <p className="gs-sub">Lost the laptop. Is it still on and online?</p>}
      {st && (
        <>
          <div className="gs-tag">{st.phase === 'lobby' ? 'LOBBY' : st.phase === 'finale' ? 'FINISHED' : `${round?.fun ? 'BONUS · ' : ''}ROUND ${st.round + 1} OF ${ROUNDS.length} · ${round?.title.toUpperCase()}`}</div>
          {st.phase === 'lobby' && <p className="gs-sub">{st.players.length} on their phones: {st.players.map((p) => p.name).join(', ') || 'nobody yet'}</p>}
          {round && st.phase !== 'lobby' && st.phase !== 'finale' && <><p className="gs-setup small">{round.setup}</p><p className="gs-ask small">{round.ask}</p></>}
          {(st.phase === 'writing' || st.phase === 'voting') && <p className="gs-sub">{st.doneCount} of {st.players.length} done{left !== null ? ` · ${left}s left` : ''}</p>}

          {st.phase === 'voting' && <div className="gs-opts">{st.answers.map((a) => (
            <div key={a.aid} className="gs-opt" style={{ cursor: 'default' }}>{a.text}
              <button className="gs-mini" style={{ float: 'right' }} onClick={() => cmd('remove', a.aid)}>Remove</button></div>
          ))}</div>}

          {st.phase === 'reveal' && <>
            <div className="gs-opts">{st.answers.map((a) => (
              <div key={a.aid} className="gs-opt" style={{ cursor: 'default' }}>{a.text}<br /><small>{a.by} · {a.votes} {a.votes === 1 ? 'vote' : 'votes'}</small></div>
            ))}</div>
            {round?.lens && <p className="gs-lens">“{round.lens.text}” <b>{round.lens.ref}</b></p>}
          </>}

          {st.phase !== 'finale' && <button className="gs-send" style={{ marginTop: 16 }} onClick={() => cmd('next')}>{NEXT[st.phase]} ▸</button>}
          <div className="row" style={{ marginTop: 14, gap: 10, justifyContent: 'space-between' }}>
            <button className="gs-mini" onClick={() => cmd('mute')}>{st.muted ? '🔇 Sound off' : '🔊 Sound on'}</button>
            {st.phase !== 'lobby' && st.phase !== 'finale' && <button className="gs-mini" onClick={() => { if (confirm('End the show now?')) cmd('finish'); }}>⏹ End show</button>}
            {st.phase !== 'lobby' && <button className="gs-mini" onClick={() => { if (confirm('Start the whole show over?')) cmd('restart'); }}>↺ Restart</button>}
          </div>
        </>
      )}
    </div>
  );
}
