import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { syncPet, type AppState } from '../lib/api';
import { useSession } from '../lib/useSession';
import Pet from '../pet/Pet';
import Confetti from '../pet/Confetti';
import { SAMPLE_QUIZ } from '../mock/sampleQuiz';
import { useMock, updateMock, todayLocal, mockEnabled } from '../mock/store';

// MOCKUP of the daily quiz (spec 2026-10-11-quiz-talents-costumes-design.md §2). Graded in the browser with
// pretend Talents; the real version grades on the server.
const PER = 10;

export default function Quiz() {
  const nav = useNavigate();
  const session = useSession();
  const mock = useMock();
  const [state, setState] = useState<AppState | null>(null);
  const [step, setStep] = useState<'read' | 'ask' | 'done'>('read');
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [right, setRight] = useState(0);
  const [lookBack, setLookBack] = useState(false);
  const [earned, setEarned] = useState(0);
  const [practice] = useState(() => mock.quizEarnedOn === todayLocal());

  useEffect(() => { if (session) syncPet().then(setState); }, [session]);

  if (!mockEnabled()) return <Navigate to="/home" replace />;
  if (session === undefined) return null;
  if (!session) return <Navigate to="/" replace />;
  if (!state?.pet) return <main><p className="sub">Loading…</p></main>;
  const pet = state.pet;
  const Q = SAMPLE_QUIZ.questions;
  const q = Q[i];

  function choose(k: number) {
    if (picked !== null) return;
    setPicked(k);
    if (k === q.answer) setRight((r) => r + 1);
  }
  function next() {
    if (i + 1 < Q.length) { setI(i + 1); setPicked(null); setLookBack(false); return; }
    const total = right * PER;
    if (!practice) {
      updateMock((m) => ({ ...m, talents: m.talents + total, quizEarnedOn: todayLocal() }));
      setEarned(total);
    }
    setStep('done');
  }

  const passage = (highlight?: number) => (
    <div className="passage">
      <p className="story-kind" style={{ color: 'var(--muted)' }}>{SAMPLE_QUIZ.ref}</p>
      {SAMPLE_QUIZ.verses.map((v) => (
        <p key={v.n} className={highlight === v.n ? 'hl' : ''}><sup>{v.n}</sup> {v.text}</p>
      ))}
    </div>
  );

  return (
    <main>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button className="back" onClick={() => nav('/home')}>‹ Home</button>
        <span className="talent-pill">🪙 {mock.talents}</span>
      </div>
      <p className="mock-note">MOCKUP · pretend Talents, saved only on this phone</p>

      {step === 'read' && <>
        <h1>📖 Today's Quiz</h1>
        <p className="sub">{practice ? 'Practice round. Talents count on your first try each day.' : `Read the passage, then answer 5 questions. Up to ${Q.length * PER} Talents!`}</p>
        <div className="card">{passage()}</div>
        <button className="warm" onClick={() => setStep('ask')}>I've read it, start the quiz</button>
      </>}

      {step === 'ask' && <>
        <div className="steps">{Q.map((_, k) => <span key={k} className={k <= i ? 'on' : ''} />)}</div>
        <h2 style={{ fontSize: '1.35rem' }}>{q.q}</h2>
        <div className="choices">
          {q.choices.map((c, k) => {
            const cls = picked === null ? '' : k === q.answer ? 'right' : k === picked ? 'missed' : 'dim';
            return <button key={k} className={`choice ${cls}`} onClick={() => choose(k)}>{c}</button>;
          })}
        </div>
        {picked !== null && (picked === q.answer
          ? <div className="banner pop" style={{ background: '#e3f8ec' }}>✅ Nice! {practice ? '' : `+${PER} 🪙`}</div>
          : <div className="card pop" style={{ textAlign: 'left' }}><b>Here's where it is: verse {q.verse}</b>{passage(q.verse)}</div>)}
        {picked === null
          ? <button className="secondary" onClick={() => setLookBack(!lookBack)}>📖 {lookBack ? 'Hide passage' : 'Look back'}</button>
          : <button onClick={next}>{i + 1 < Q.length ? 'Next question' : 'Finish'}</button>}
        {lookBack && picked === null && <div className="card">{passage()}</div>}
      </>}

      {step === 'done' && <div className="center">
        {earned > 0 && <Confetti />}
        <div className="stage-pet"><div className="pet-party"><Pet species={pet.species} variant={pet.colorVariant} mood="thriving" stage={pet.stage} outfit={mock.outfit} size={180} animate={false} /></div></div>
        <h1>{practice ? `${right}/${Q.length} in practice!` : earned ? `You earned ${earned} Talents! 🎃` : 'Thanks for reading! 📖'}</h1>
        <p className="sub">You have <b>🪙 {mock.talents}</b> Talents.</p>
        <button className="warm" onClick={() => nav('/shop')}>🎃 Visit the costume shop</button>
        <button className="ghost" onClick={() => nav('/home')}>Back to {pet.name}</button>
      </div>}
    </main>
  );
}
