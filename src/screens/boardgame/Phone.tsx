import { useEffect, useRef, useState } from 'react';
import { Navigate, Link } from 'react-router';
import { supabase } from '../../lib/supabase';
import { syncPet } from '../../lib/api';
import { useSession, isStudentEmail } from '../../lib/useSession';
import Pet from '../../pet/Pet';
import type { SpeciesId } from '../../domain/species';
import { RESOURCE_ICON, RESOURCE_NAME, RESOURCES, ALTAR_COST, TEMPLE_COST, WIN_POINTS, type Resource } from '../../boardgame/board';
import type { Hand, PublicState } from '../../boardgame/engine';
import { openWire, type Wire } from '../../boardgame/channel';
import { sfxDiceRoll } from '../../boardgame/sfx';
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

const emptyGive = (): Partial<Hand> => ({});

function Play({ me }: { me: Me }) {
  const [st, setSt] = useState<PublicState | null>(null);
  const [rolling, setRolling] = useState(false);
  const [give, setGive] = useState<Partial<Hand>>(emptyGive());
  const [want, setWant] = useState<Partial<Hand>>(emptyGive());
  const [tradeWith, setTradeWith] = useState('');
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

  useEffect(() => { if (rolling && st?.currentId !== me.id) setRolling(false); }, [st, rolling, me.id]);

  const myTurn = st?.currentId === me.id;
  const me2 = st?.players.find((p) => p.id === me.id);
  const myBuildings = st?.tiles.flatMap((t) => t.settlers.filter((s) => s.playerId === me.id).map((s) => ({ ...s, tileId: t.id }))) ?? [];
  const myAltars = myBuildings.filter((b) => b.level === 1);
  const myOffers = st?.trades.filter((t) => t.from === me.id) ?? [];
  const otherOffers = st?.trades.filter((t) => t.from !== me.id && (!t.to || t.to === me.id)) ?? [];

  const canAfford = (hand: Hand | undefined, cost: Partial<Hand>) => !!hand && (Object.keys(cost) as Resource[]).every((r) => hand[r] >= (cost[r] ?? 0));

  const roll = () => {
    if (rolling) return;
    sfxDiceRoll(6);
    setRolling(true);
    setTimeout(() => setRolling(false), 2500);
    wire.current?.sendToHost({ t: 'roll', id: me.id, die1: 1 + Math.floor(Math.random() * 6), die2: 1 + Math.floor(Math.random() * 6) });
  };
  const settleTile = (tileId: number) => wire.current?.sendToHost({ t: 'settle', id: me.id, tileId });
  const buildTile = (tileId: number) => wire.current?.sendToHost({ t: 'build', id: me.id, tileId });
  const upgradeTile = (tileId: number) => wire.current?.sendToHost({ t: 'upgrade', id: me.id, tileId });
  const sendTrade = () => {
    if (Object.keys(give).length === 0 && Object.keys(want).length === 0) return;
    wire.current?.sendToHost({ t: 'proposeTrade', id: me.id, give, want, to: tradeWith || null });
    setGive(emptyGive()); setWant(emptyGive()); setTradeWith('');
  };
  const bump = (set: (f: (h: Partial<Hand>) => Partial<Hand>) => void, r: Resource, delta: number) =>
    set((h) => { const n = Math.max(0, (h[r] ?? 0) + delta); const next = { ...h, [r]: n }; if (n === 0) delete next[r]; return next; });

  const findName = (id: string) => st?.players.find((p) => p.id === id)?.name ?? '?';
  const fmt = (h: Partial<Hand>) => (Object.keys(h) as Resource[]).filter((r) => h[r]).map((r) => `${h[r]}${RESOURCE_ICON[r]}`).join(' ') || 'nothing';

  return (
    <div className="bg bg-phone">
      <div className="bg-logo small">{st?.title.toUpperCase() ?? 'THE ROAD BACK HOME'}</div>
      <div style={{ textAlign: 'center' }}><Pet species={me.species as SpeciesId} variant={me.color} mood="thriving" stage="grown" size={st && st.phase !== 'lobby' ? 60 : 140} /></div>

      {!st && <p className="bg-sub">Waiting for the game to start…</p>}
      {st?.phase === 'lobby' && <><p className="bg-big small">You're in, {me.name}!</p><p className="bg-sub">Look at the screen. The game starts soon.</p></>}

      {st?.phase === 'settle' && (
        st.currentId === me.id
          ? <>
            <p className="bg-big small">Pick your tile!</p>
            <div className="bg-tiles">
              {st.tiles.map((t) => (
                <button key={t.id} className={`bg-tile bg-${t.resource} ${t.settlers.length >= 2 ? 'bg-full' : 'bg-pickable'}`}
                  disabled={t.settlers.length >= 2} onClick={() => settleTile(t.id)}>
                  <span className="bg-tile-icon">{RESOURCE_ICON[t.resource]}</span>
                  <span className="bg-tile-num">{t.number}</span>
                  <span className="bg-tile-label">{t.label}</span>
                </button>
              ))}
            </div>
          </>
          : <p className="bg-sub">Waiting on {findName(st.currentId ?? '')} to pick a tile…</p>
      )}

      {st && st.phase === 'playing' && !st.card && (
        <>
          {myTurn
            ? <button className={`bg-send ${rolling ? 'bg-rolling' : ''}`} onClick={roll} disabled={rolling}>{rolling ? '🎲 Rolling…' : '🎲 ROLL!'}</button>
            : <p className="bg-sub">Waiting on {findName(st.currentId ?? '')}…</p>}

          <p className="bg-sub">Your points: {me2?.points ?? 0} / {WIN_POINTS} to win</p>
          <div className="bg-hand">
            {RESOURCES.map((r) => <span key={r} className="bg-chip">{RESOURCE_ICON[r]} <b>{me2?.resources[r] ?? 0}</b></span>)}
          </div>

          <p className="bg-ask small">Build an Altar ({fmt(ALTAR_COST)})</p>
          <div className="bg-tiles">
            {st.tiles.map((t) => (
              <button key={t.id} className={`bg-tile bg-${t.resource} ${t.settlers.length >= 2 || !canAfford(me2?.resources, ALTAR_COST) ? 'bg-full' : 'bg-pickable'}`}
                disabled={t.settlers.length >= 2 || !canAfford(me2?.resources, ALTAR_COST) || myBuildings.length >= 3}
                onClick={() => buildTile(t.id)}>
                <span className="bg-tile-icon">{RESOURCE_ICON[t.resource]}</span><span className="bg-tile-num">{t.number}</span>
              </button>
            ))}
          </div>

          {myAltars.length > 0 && (
            <>
              <p className="bg-ask small">Upgrade an Altar to a Temple ({fmt(TEMPLE_COST)})</p>
              <div className="bg-row">
                {myAltars.map((a) => (
                  <button key={a.tileId} className="bg-go" disabled={!canAfford(me2?.resources, TEMPLE_COST)} onClick={() => upgradeTile(a.tileId)}>
                    Tile {a.tileId} ▸
                  </button>
                ))}
              </div>
            </>
          )}

          <p className="bg-ask small">Propose a trade</p>
          <div className="bg-row">
            {RESOURCES.map((r) => (
              <span key={r} className="bg-chip">{RESOURCE_ICON[r]}
                <button className="bg-mini" onClick={() => bump(setGive, r, 1)}>Give+</button>
                <button className="bg-mini" onClick={() => bump(setGive, r, -1)}>-</button>
                {give[r] ?? 0}
              </span>
            ))}
          </div>
          <div className="bg-row">
            {RESOURCES.map((r) => (
              <span key={r} className="bg-chip">{RESOURCE_ICON[r]}
                <button className="bg-mini" onClick={() => bump(setWant, r, 1)}>Want+</button>
                <button className="bg-mini" onClick={() => bump(setWant, r, -1)}>-</button>
                {want[r] ?? 0}
              </span>
            ))}
          </div>
          <select className="bg-select" value={tradeWith} onChange={(e) => setTradeWith(e.target.value)}>
            <option value="">Offer to anyone</option>
            {st.players.filter((p) => p.id !== me.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="bg-go main" onClick={sendTrade}>Offer trade</button>

          {myOffers.length > 0 && <div className="bg-trades">{myOffers.map((o) => (
            <div key={o.id} className="bg-trade-card">
              <div className="bg-trade-row"><span>You offer {fmt(o.give)} for {fmt(o.want)}</span>
                <button className="bg-mini" onClick={() => wire.current?.sendToHost({ t: 'cancelTrade', id: me.id, offerId: o.id })}>Cancel</button></div>
            </div>
          ))}</div>}
          {otherOffers.length > 0 && <div className="bg-trades">{otherOffers.map((o) => (
            <div key={o.id} className="bg-trade-card">
              <div className="bg-trade-row"><span>{findName(o.from)} offers {fmt(o.give)} for {fmt(o.want)}</span>
                <button className="bg-go main" disabled={!canAfford(me2?.resources, o.want)} onClick={() => wire.current?.sendToHost({ t: 'acceptTrade', id: me.id, offerId: o.id })}>Accept</button></div>
            </div>
          ))}</div>}
        </>
      )}

      {st?.card && (
        <div className="bg-card">
          <p className="bg-tag">{st.card.prompt}</p>
          {st.card.q && <p className="bg-ask small">{st.card.q}</p>}
          <p className="bg-sub">Look at the screen up front.</p>
        </div>
      )}

      {st?.phase === 'finished' && <>
        <p className="bg-big small">{st.winnerId === me.id ? 'You won! 🏆' : `${findName(st.winnerId ?? '')} won! 🏆`}</p>
        <Link to="/home"><button className="bg-send">Back to your pet</button></Link>
      </>}
    </div>
  );
}
