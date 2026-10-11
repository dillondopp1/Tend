import { useEffect, useState } from 'react';
import { currentPlatform, type InstallPlatform } from './platform';

interface BeforeInstallPromptEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }
const KEY = 'tend.installDismissed';
const getDeferred = () => (window as Window & { __tendInstall?: BeforeInstallPromptEvent }).__tendInstall;

function readDismissed(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}
function writeDismissed() {
  try { localStorage.setItem(KEY, '1'); } catch { /* private mode: just show it again next time */ }
}

export default function InstallPrompt() {
  const [platform] = useState<InstallPlatform>(currentPlatform);
  const [canPrompt, setCanPrompt] = useState(!!getDeferred());
  const [full, setFull] = useState(!readDismissed());

  useEffect(() => {
    const on = () => setCanPrompt(true);
    window.addEventListener('tend-installable', on);
    return () => window.removeEventListener('tend-installable', on);
  }, []);

  if (platform === 'installed' || platform === 'other') return null;

  async function install() {
    const ev = getDeferred();
    if (!ev) return;
    await ev.prompt();
    await ev.userChoice;
  }

  const steps = (() => {
    switch (platform) {
      case 'ios-safari':
        return <ol><li>Tap the <b>Share</b> button <span aria-hidden>⬆️</span> at the bottom of Safari</li><li>Scroll and tap <b>Add to Home Screen</b> ➕</li><li>Tap <b>Add</b></li></ol>;
      case 'ios-other':
        return <ol><li>Tap the <b>Share</b> button <span aria-hidden>⬆️</span></li><li>Tap <b>Add to Home Screen</b> ➕</li><li>Not there? Open this page in <b>Safari</b> and try again</li></ol>;
      case 'in-app':
        return <p>You're inside another app's browser. Tap the <b>⋯</b> menu and choose <b>Open in browser</b>, then add Tend to your home screen.</p>;
      case 'android':
        return canPrompt
          ? <button onClick={install}>Install Tend 📲</button>
          : <ol><li>Tap the <b>⋮</b> menu in Chrome</li><li>Tap <b>Install app</b> or <b>Add to Home screen</b></li></ol>;
    }
  })();

  if (!full) {
    return (
      <div className="card" onClick={() => setFull(true)} role="button" style={{ cursor: 'pointer' }}>
        📲 <b>Put Tend on your home screen</b> so {`it's`} one tap away.
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(43,33,64,0.55)', display: 'grid', placeItems: 'center', padding: 16, zIndex: 50 }}>
      <div className="card" style={{ maxWidth: 420, width: '100%' }}>
        <h2>Put Tend on your home screen 🏡</h2>
        <p>Your pet lives there. It opens like a real app, full screen.</p>
        {steps}
        <button className="secondary" onClick={() => { writeDismissed(); setFull(false); }}>Maybe later</button>
      </div>
    </div>
  );
}
