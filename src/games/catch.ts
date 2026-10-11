import { W, H, type Game, type GameOpts, themeFor, petImage, sky, word, hud, Phrase, rand, motifs } from './engine';

// Slide your pet to catch good things and the key-phrase words; dodge the storm clouds. 3 hearts.
export function createCatch(o: GameOpts): Game {
  const t = themeFor(o.palette);
  const pet = petImage(o.species, o.variant);
  const phrase = new Phrase(o.phrase, o.phraseRef);
  const words = phrase.words;
  const good = motifs(o.motifs);
  const PY = H - 110, PR = 34;
  let px = W / 2, target = W / 2, hearts = 3, time = 0, spawn = 0, hurt = 0, pop = 0;
  type Item = { x: number; y: number; kind: 'good' | 'bad' | 'word'; e: string; w?: number; vy: number };
  const items: Item[] = [];

  const g: Game = {
    over: false, started: false, score: 0, phraseDone: false,
    press(x) { g.started = true; target = x; },
    move(x) { if (g.started) target = x; },
    step(dt) {
      phrase.step(dt);
      if (!g.started || g.over) return;
      time += dt; hurt = Math.max(0, hurt - dt); pop = Math.max(0, pop - dt);
      px += (Math.max(PR, Math.min(W - PR, target)) - px) * Math.min(1, dt * 14);
      const level = Math.min(1, time / 75);
      spawn -= dt;
      if (spawn <= 0) {
        spawn = 0.85 - level * 0.45;
        const r = Math.random();
        const vy = 170 + level * 230 + rand(0, 40);
        if (r < 0.26) items.push({ x: rand(40, W - 40), y: -30, kind: 'word', e: '', w: phrase.next(), vy: vy * 0.8 });
        else if (r < 0.26 + 0.2 + level * 0.16) items.push({ x: rand(30, W - 30), y: -30, kind: 'bad', e: '⛈️', vy });
        else items.push({ x: rand(30, W - 30), y: -30, kind: 'good', e: good[Math.floor(rand(0, good.length))], vy });
      }
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i]; it.y += it.vy * dt;
        const hit = Math.abs(it.y - PY) < 38 && Math.abs(it.x - px) < (it.kind === 'word' ? 50 : 40);
        if (hit) {
          items.splice(i, 1);
          if (it.kind === 'bad') { hearts -= 1; hurt = 0.6; if (hearts <= 0) g.over = true; }
          else if (it.kind === 'word') {
            g.score += 3; pop = 0.4;
            if (phrase.collect(it.w!)) { g.phraseDone = true; g.score += 10; }
          } else { g.score += 1; pop = 0.2; }
        } else if (it.y > H + 40) {
          items.splice(i, 1);
        }
      }
    },
    draw(ctx) {
      sky(ctx, t);
      ctx.fillStyle = t.ground; ctx.fillRect(0, H - 60, W, 60);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const it of items) {
        if (it.kind === 'word') word(ctx, words[it.w!], it.x, it.y);
        else { ctx.font = '36px serif'; ctx.fillText(it.e, it.x, it.y); }
      }
      ctx.save(); ctx.translate(px, PY);
      if (hurt > 0 && Math.floor(hurt * 12) % 2) ctx.globalAlpha = 0.4;
      const s = 1 + pop * 0.5;
      ctx.drawImage(pet, -PR * 1.7 * s, -PR * 1.9 * s, PR * 3.4 * s, PR * 3.4 * s); ctx.restore();
      hud(ctx, g.score, t, g.started ? '❤️'.repeat(hearts) + '🤍'.repeat(3 - hearts) : 'Drag to move. Catch the good stuff, dodge ⛈️');
      phrase.drawBanner(ctx, 108);
      phrase.drawCelebration(ctx);
    },
  };
  return g;
}
