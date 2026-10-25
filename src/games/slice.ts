import { W, H, type Game, type GameOpts, themeFor, petImage, sky, hud, motifs, rand, Phrase, bigWord } from './engine';

// Fruit-Ninja style: swipe across things tossed into the air. Slice the phrase words (big, glowing)
// and the good stuff; don't slice the storm clouds. Three storms and the run is over.
interface Item { x: number; y: number; vx: number; vy: number; r: number; kind: 'good' | 'word' | 'storm'; e?: string; w?: number; rot: number; vr: number }
interface Half { x: number; y: number; vx: number; vy: number; rot: number; vr: number; e: string; side: number; word?: string }
const GRAV = 820;

export function createSlice(o: GameOpts): Game {
  const t = themeFor(o.palette);
  const pet = petImage(o.species, o.variant);
  const phrase = new Phrase(o.phrase, o.phraseRef, o.phraseMeaning);
  const good = motifs(o.motifs);
  const items: Item[] = [], halves: Half[] = [], trail: { x: number; y: number; t: number }[] = [];
  const pops: { x: number; y: number; text: string; t: number }[] = [];
  let lives = 3, time = 0, wave = 0.6, down = false, last: { x: number; y: number } | null = null, swipeHits = 0, hurt = 0, cheer = 0;

  function toss() {
    const level = Math.min(1, time / 70);
    const n = 1 + Math.floor(rand(0, 1.6 + level * 2.4));
    for (let k = 0; k < n; k++) {
      const x = rand(50, W - 50);
      const r = Math.random();
      const kind: Item['kind'] = r < 0.34 ? 'word' : r < 0.34 + 0.1 + level * 0.12 ? 'storm' : 'good';
      items.push({
        x, y: H + 40, vx: (W / 2 - x) * rand(0.35, 0.8), vy: -rand(820, 1000),
        r: kind === 'word' ? 46 : 30, kind, e: kind === 'good' ? good[Math.floor(rand(0, good.length))] : kind === 'storm' ? '⛈️' : undefined,
        w: kind === 'word' ? phrase.next() : undefined, rot: 0, vr: kind === 'word' ? rand(-0.6, 0.6) : rand(-4, 4),
      });
    }
    wave = Math.max(0.55, 1.25 - level * 0.6) + rand(0, 0.35);
  }

  function cut(ax: number, ay: number, bx: number, by: number) {
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      // distance from item centre to the swipe segment
      const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1;
      const u = Math.max(0, Math.min(1, ((it.x - ax) * dx + (it.y - ay) * dy) / L));
      if (Math.hypot(ax + u * dx - it.x, ay + u * dy - it.y) > it.r) continue;
      items.splice(i, 1);
      const label = it.kind === 'word' ? phrase.words[it.w!] : undefined;
      for (const side of [-1, 1]) halves.push({ x: it.x, y: it.y, vx: it.vx * 0.4 + side * 140, vy: it.vy * 0.3 - 120, rot: it.rot, vr: side * 5, e: it.e ?? '', side, word: label });
      if (it.kind === 'storm') { lives--; hurt = 0.5; pops.push({ x: it.x, y: it.y, text: '⚡ -1', t: 0.9 }); if (lives <= 0) g.over = true; continue; }
      swipeHits++;
      if (it.kind === 'word') {
        g.score += 5; pops.push({ x: it.x, y: it.y - 30, text: label!, t: 1 });
        if (phrase.collect(it.w!)) { g.score += 25; g.phraseDone = true; cheer = 1; }
      } else g.score += 1;
      if (swipeHits === 3) { g.score += 3; pops.push({ x: it.x, y: it.y - 50, text: 'Combo! +3', t: 0.9 }); }
    }
  }

  const g: Game = {
    over: false, started: false, score: 0, phraseDone: false,
    press(x, y) { if (g.over) return; g.started = true; down = true; last = { x, y }; swipeHits = 0; trail.push({ x, y, t: 0.25 }); },
    move(x, y) {
      if (!down || !last || g.over) return;
      cut(last.x, last.y, x, y);
      last = { x, y }; trail.push({ x, y, t: 0.25 });
    },
    release() { down = false; last = null; },
    step(dt) {
      phrase.step(dt); hurt = Math.max(0, hurt - dt); cheer = Math.max(0, cheer - dt);
      for (let i = trail.length - 1; i >= 0; i--) { trail[i].t -= dt; if (trail[i].t <= 0) trail.splice(i, 1); }
      for (let i = pops.length - 1; i >= 0; i--) { pops[i].t -= dt; pops[i].y -= 40 * dt; if (pops[i].t <= 0) pops.splice(i, 1); }
      for (let i = halves.length - 1; i >= 0; i--) {
        const h = halves[i]; h.vy += GRAV * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.rot += h.vr * dt;
        if (h.y > H + 80) halves.splice(i, 1);
      }
      if (!g.started || g.over) return;
      time += dt; wave -= dt;
      if (wave <= 0) toss();
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i]; it.vy += GRAV * dt; it.x += it.vx * dt; it.y += it.vy * dt; it.rot += it.vr * dt;
        if (it.y > H + 60 && it.vy > 0) items.splice(i, 1); // missed: no penalty, it'll come round again
      }
    },
    draw(ctx) {
      sky(ctx, t);
      ctx.drawImage(pet, W / 2 - 45, H - 120 + (cheer > 0 ? -Math.abs(Math.sin(cheer * 12)) * 16 : 0), 90, 90);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      // Words first, then fruit, then storms on top: a big word can never hide a storm.
      const order = { word: 0, good: 1, storm: 2 } as const;
      for (const it of [...items].sort((a, b) => order[a.kind] - order[b.kind])) {
        if (it.kind === 'word') bigWord(ctx, phrase.words[it.w!], it.x, it.y, 1.05);
        else { ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot); ctx.font = '54px serif'; ctx.fillText(it.e!, 0, 0); ctx.restore(); }
      }
      for (const h of halves) {
        ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.rot);
        ctx.beginPath(); ctx.rect(h.side < 0 ? -80 : 0, -40, 80, 80); ctx.clip();
        if (h.word) { ctx.globalAlpha = 0.85; bigWord(ctx, h.word, 0, 0, 1.15); } else { ctx.font = '54px serif'; ctx.fillText(h.e, 0, 0); }
        ctx.restore();
      }
      // Blade trail
      if (trail.length > 1) {
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (let k = 1; k < trail.length; k++) {
          ctx.strokeStyle = `rgba(255,255,255,${Math.min(1, trail[k].t * 4)})`; ctx.lineWidth = 2 + trail[k].t * 30;
          ctx.beginPath(); ctx.moveTo(trail[k - 1].x, trail[k - 1].y); ctx.lineTo(trail[k].x, trail[k].y); ctx.stroke();
        }
      }
      for (const p of pops) { ctx.globalAlpha = Math.min(1, p.t * 2); ctx.fillStyle = '#5b3fe0'; ctx.font = '900 22px Nunito, system-ui, sans-serif'; ctx.fillText(p.text, p.x, p.y); }
      ctx.globalAlpha = 1;
      if (hurt > 0) { ctx.fillStyle = `rgba(255,80,80,${hurt * 0.4})`; ctx.fillRect(0, 0, W, H); }
      hud(ctx, g.score, t, g.started ? '❤️'.repeat(Math.max(0, lives)) + '🤍'.repeat(3 - Math.max(0, lives)) : 'Swipe to slice the words! Skip the ⛈️');
      phrase.drawBanner(ctx, 100);
    },
  };
  return g;
}
