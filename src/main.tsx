import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
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
