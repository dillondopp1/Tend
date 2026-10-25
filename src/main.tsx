import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { registerSW } from 'virtual:pwa-register';
import { trackRoles } from './lib/roleSwitch';

trackRoles();

// Chrome fires this once, often before React mounts. Keep it for InstallPrompt.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  (window as Window & { __tendInstall?: Event }).__tendInstall = e;
  window.dispatchEvent(new Event('tend-installable'));
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Pick up new versions quickly: look for one on every open, when the app comes back to the front,
// and every 5 minutes. A fresh version takes over and reloads the page by itself.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() { void updateSW(true); },
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    const check = () => { if (navigator.onLine) reg.update().catch(() => {}); };
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    setInterval(check, 5 * 60_000);
  },
});
