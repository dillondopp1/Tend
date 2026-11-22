/** Tiny procedural sound effects (no audio files) for the card game, using WebAudio. */
let ctx: AudioContext | null = null;
const getCtx = () => (ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)());

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.18) {
  const c = getCtx();
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type; osc.frequency.value = freq;
  osc.connect(g); g.connect(c.destination);
  const t0 = c.currentTime + start;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

/** Soft card-slap when someone plays a card. */
export function sfxPlay() {
  try { tone(260, 0, 0.08, 'square', 0.1); } catch { /* audio blocked */ }
}
/** Drumroll-ish ticks when the cards flip over for the judge. */
export function sfxFlip() {
  try { for (let i = 0; i < 6; i++) tone(300 + i * 40, i * 0.06, 0.06, 'square', 0.07); } catch { /* audio blocked */ }
}
/** Chime when the judge picks a winner. */
export function sfxWin() {
  try { [523, 659, 784].forEach((f, i) => tone(f, i * 0.09, 0.25, 'triangle')); } catch { /* audio blocked */ }
}
/** Fanfare for the game winner. */
export function sfxChampion() {
  try { [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.11, 0.35, 'triangle', 0.2)); } catch { /* audio blocked */ }
}
