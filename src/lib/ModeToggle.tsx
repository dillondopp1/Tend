import { useState } from 'react';
import { useNavigate } from 'react-router';
import { switchTo, useCanSwitchTo, type Role } from './roleSwitch';

/** Fox | Teacher switch. Only renders where the other role has a saved session (i.e. on Dillon's own devices). */
export default function ModeToggle({ current }: { current: Role }) {
  const other: Role = current === 'student' ? 'teacher' : 'student';
  const can = useCanSwitchTo(other);
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!can && !failed) return null;
  async function flip() {
    setBusy(true); setFailed(false);
    const ok = await switchTo(other);
    setBusy(false);
    if (ok) nav(other === 'teacher' ? '/teacher' : '/home');
    else setFailed(true);
  }
  const label = (r: Role) => (r === 'student' ? '🦊 Fox' : '🧑‍🏫 Teacher');
  return (
    <div className="mode-toggle" role="group" aria-label="Switch between fox and teacher mode">
      <div className="mode-pill">
        {(['student', 'teacher'] as Role[]).map((r) => (
          <button key={r} type="button" className={r === current ? 'on' : ''} disabled={busy} aria-pressed={r === current}
            onClick={() => { if (r !== current) void flip(); }}>{label(r)}</button>
        ))}
      </div>
      {failed && <p className="error" style={{ margin: '6px 0 0' }}>That saved sign-in expired. Sign in the usual way once more.</p>}
    </div>
  );
}
