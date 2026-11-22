/** Tiny procedural sound effects (no audio files) for the board game, using WebAudio. */
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

/** Quick clicky ticks while the die "rolls". */
export function sfxDiceRoll(steps = 5) {
  try { for (let i = 0; i < steps; i++) tone(300 + Math.random() * 300, i * 0.1, 0.07, 'square', 0.08); } catch { /* audio blocked */ }
}
/** Cheerful rising chime for a good space (thankful / grace / scripture / share). */
export function sfxGood() {
  try { [523, 659, 784].forEach((f, i) => tone(f, i * 0.09, 0.22, 'triangle')); } catch { /* audio blocked */ }
}
/** Gentle descending "oops" for wandering off. */
export function sfxWander() {
  try { [392, 311].forEach((f, i) => tone(f, i * 0.12, 0.3, 'sawtooth', 0.12)); } catch { /* audio blocked */ }
}
/** Little fanfare when someone reaches home / wins. */
export function sfxHome() {
  try { [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.11, 0.35, 'triangle', 0.2)); } catch { /* audio blocked */ }
}
/** Satisfying "thunk" when a building goes up. */
export function sfxBuild() {
  try { tone(220, 0, 0.1, 'square', 0.15); tone(440, 0.07, 0.18, 'triangle', 0.16); } catch { /* audio blocked */ }
}
/** Quick swap whoosh for a completed trade. */
export function sfxTrade() {
  try { [440, 554, 440].forEach((f, i) => tone(f, i * 0.07, 0.12, 'sine', 0.12)); } catch { /* audio blocked */ }
}
