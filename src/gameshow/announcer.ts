/** Plays the pre-recorded announcer clips in public/gameshow/. One clip at a time; a queue plays them back to back. */
export class Announcer {
  private el: HTMLAudioElement | null = null;
  private token = 0;
  muted = false;

  say(keys: string | string[], onDone?: () => void) {
    this.stop();
    const list = Array.isArray(keys) ? keys.slice() : [keys];
    const mine = ++this.token;
    if (this.muted) { onDone?.(); return; }
    const next = () => {
      if (mine !== this.token) return;
      const k = list.shift();
      if (!k) { onDone?.(); return; }
      const a = new Audio(`/gameshow/${k}.mp3`);
      this.el = a;
      a.onended = next;
      a.onerror = next;
      a.play().catch(next);
    };
    next();
  }

  stop() {
    this.token++;
    if (this.el) { this.el.onended = null; this.el.pause(); this.el = null; }
  }
}
