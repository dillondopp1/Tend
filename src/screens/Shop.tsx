import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { syncPet, type AppState } from '../lib/api';
import { useSession } from '../lib/useSession';
import Pet from '../pet/Pet';
import Confetti from '../pet/Confetti';
import { HALLOWEEN, wear, takeOff, type CostumeItem, type Outfit } from '../pet/costumes';
import { useMock, updateMock, mockEnabled } from '../mock/store';

// MOCKUP of the Halloween shop (spec §4) with pretend Talents kept in this browser.
const CLOSES = new Date('2026-11-01T00:00:00-06:00');

export default function Shop() {
  const nav = useNavigate();
  const session = useSession();
  const mock = useMock();
  const [state, setState] = useState<AppState | null>(null);
  const [tryOn, setTryOn] = useState<Outfit | null>(null);
  const [bought, setBought] = useState('');

  useEffect(() => { if (session) syncPet().then(setState); }, [session]);

  if (!mockEnabled()) return <Navigate to="/home" replace />;
  if (session === undefined) return null;
  if (!session) return <Navigate to="/" replace />;
  if (!state?.pet) return <main><p className="sub">Loading…</p></main>;
  const pet = state.pet;
  const days = Math.max(0, Math.ceil((CLOSES.getTime() - Date.now()) / 86_400_000));
  const shown = tryOn ?? mock.outfit;
  const worn = (it: CostumeItem) => mock.outfit[it.slot] === it.id;

  function buy(it: CostumeItem) {
    if (mock.talents < it.price) return;
    updateMock((m) => ({ ...m, talents: m.talents - it.price, owned: [...m.owned, it.id], outfit: wear(m.outfit, it) }));
    setTryOn(null); setBought(it.id);
  }

  return (
    <main>
      {bought && <Confetti key={bought} />}
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button className="back" onClick={() => nav('/home')}>‹ Home</button>
        <span className="talent-pill">🪙 {mock.talents}</span>
      </div>
      <p className="mock-note">MOCKUP · pretend Talents, saved only on this phone</p>
      <h1>🎃 Halloween Shop</h1>
      <div className="banner">Closes in {days} day{days === 1 ? '' : 's'}! Costumes you buy are yours forever.</div>
      <div className="stage-pet" style={{ margin: '6px 0' }}>
        <Pet species={pet.species} variant={pet.colorVariant} mood="thriving" stage={pet.stage} outfit={shown} size={230} />
      </div>
      {tryOn && <p className="center sub" style={{ margin: 0 }}>Trying it on… <button className="ghost" style={{ width: 'auto', margin: 0, padding: 4 }} onClick={() => setTryOn(null)}>Undo</button></p>}

      {(['head', 'body', 'full'] as const).map((slot) => (
        <div key={slot}>
          <h2 style={{ marginTop: 18 }}>{slot === 'head' ? '🎩 Hats & ears' : slot === 'body' ? '🦇 Capes, wings & scarves' : '👻 Full costumes'}</h2>
          <div className="shop-grid">
            {HALLOWEEN.filter((it) => it.slot === slot).map((it) => {
              const owned = mock.owned.includes(it.id);
              const short = it.price - mock.talents;
              return (
                <div key={it.id} className={`shop-item ${worn(it) ? 'on' : ''}`}>
                  <button className="shop-thumb" onClick={() => setTryOn(wear(mock.outfit, it))} aria-label={`Try on ${it.name}`}>
                    <Pet species={pet.species} variant={pet.colorVariant} mood="thriving" outfit={{ [it.slot]: it.id }} size={86} animate={false} />
                  </button>
                  <b>{it.name}</b>
                  {owned
                    ? (worn(it)
                      ? <button className="mini secondary" onClick={() => updateMock((m) => ({ ...m, outfit: takeOff(m.outfit, it) }))}>Take off</button>
                      : <button className="mini" onClick={() => { updateMock((m) => ({ ...m, outfit: wear(m.outfit, it) })); setTryOn(null); }}>Wear</button>)
                    : short > 0
                      ? <span className="d">🪙 {it.price} · {short} to go</span>
                      : <button className="mini warm" onClick={() => buy(it)}>Buy · 🪙 {it.price}</button>}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="card" style={{ marginTop: 24, background: '#fff3d6' }}>
        <b>🧪 Mockup tools</b>
        <p className="sub" style={{ margin: '4px 0' }}>Only in this preview, to try buying without doing lots of quizzes.</p>
        <div className="row">
          <button className="mini" onClick={() => updateMock((m) => ({ ...m, talents: m.talents + 200 }))}>+200 🪙</button>
          <button className="mini secondary" onClick={() => { updateMock(() => ({ talents: 0, owned: [], outfit: {} })); setTryOn(null); }}>Reset</button>
        </div>
      </div>
    </main>
  );
}
