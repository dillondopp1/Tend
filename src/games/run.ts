import { W, H, type Game, type GameOpts, themeFor, petImage, hud, motifs, rand, Phrase, bigWord, drawAmbient } from './engine';

// Temple-Run style: three lanes rushing toward you. Swipe left/right to change lane, up to jump,
// down to slide (or tap the left/right side to change lane). Phrase words fill the track.
const HORIZON = 190, GROUND = H - 70, FAR = 60, F = 7, LANE = 92;
type Kind = 'rock' | 'beam' | 'wall' | 'coin' | 'word';
interface Thing { lane: number; d: number; kind: Kind; e?: string; w?: number; hit?: boolean }

const proj = (lane: number, d: number) => {
  const s = F / (F + Math.max(-2, d));
  return { x: W / 2 + lane * LANE * s, y: HORIZON + (GROUND - HORIZON) * s, s };
};

export function createRun(o: GameOpts): Game {
  const t = themeFor(o.palette);
  const pet = petImage(o.species, o.variant);
  const phrase = new Phrase(o.phrase, o.phraseRef, o.phraseMeaning);
  const deco = motifs(o.motifs);
  let lane = 0, laneX = 0, jumpT = 0, slideT = 0, speed = 16, dist = 0, bonus = 0, spawnD = 18, flash = 0, crash = 0;
  const things: Thing[] = [];
  const sides = Array.from({ length: 10 }, (_, i) => ({ d: i * 6, side: i % 2 ? 1 : -1, e: deco[i % deco.length] }));
  let down: { x: number; y: number; moved: boolean } | null = null;
  const JUMP = 0.75, SLIDE = 0.75;

  function spawnRow(d: number) {
    const lanes = [-1, 0, 1].sort(() => Math.random() - 0.5);
    const hard = Math.min(0.75, dist / 900);
    const nObs = Math.random() < hard * 0.6 ? 2 : 1;
    const obstacles: Thing[] = [];
    for (let k = 0; k < nObs; k++) {
      const r = Math.random();
      obstacles.push({ lane: lanes[k], d, kind: r < 0.4 ? 'rock' : r < 0.7 ? 'beam' : 'wall' });
    }
    things.push(...obstacles);
    // The free lane always carries a reward, and very often a phrase word.
    const free = lanes[nObs];
    if (Math.random() < 0.55) things.push({ lane: free, d, kind: 'word', w: phrase.next() });
    else for (let k = 0; k < 3; k++) things.push({ lane: free, d: d + k * 1.6, kind: 'coin', e: deco[Math.floor(rand(0, deco.length))] });
    // Extra words floating above rocks: jump to grab them.
    const rock = obstacles.find((x) => x.kind === 'rock');
    if (rock && Math.random() < 0.6) things.push({ lane: rock.lane, d: d + 0.01, kind: 'word', w: phrase.next() });
  }

  const g: Game = {
    over: false, started: false, score: 0, phraseDone: false,
    press(x, y) { if (g.over) return; g.started = true; down = { x, y, moved: false }; },
    move(x, y) {
      if (!down || down.moved) return;
      const dx = x - down.x, dy = y - down.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
      down.moved = true;
      if (Math.abs(dx) > Math.abs(dy)) lane = Math.max(-1, Math.min(1, lane + Math.sign(dx)));
      else if (dy < 0) { if (jumpT <= 0 && slideT <= 0) jumpT = JUMP; }
      else { slideT = SLIDE; jumpT = 0; }
    },
    release() {
      if (down && !down.moved && g.started) lane = Math.max(-1, Math.min(1, lane + (down.x < W / 2 ? -1 : 1)));
      down = null;
    },
    step(dt) {
      phrase.step(dt); flash = Math.max(0, flash - dt);
      if (!g.started) return;
      if (g.over) { crash += dt; return; }
      speed = Math.min(34, speed + 0.35 * dt);
      const move = speed * dt;
      dist += move; laneX += (lane - laneX) * Math.min(1, dt * 14);
      jumpT = Math.max(0, jumpT - dt); slideT = Math.max(0, slideT - dt);
      spawnD -= move;
      if (spawnD <= 0) { spawnRow(FAR); spawnD = Math.max(9, 16 - dist / 120) + rand(0, 4); }
      for (const s of sides) { s.d -= move; if (s.d < -2) s.d += 60; }
      const air = jumpT > 0 ? Math.sin((1 - jumpT / JUMP) * Math.PI) : 0;
      for (let i = things.length - 1; i >= 0; i--) {
        const th = things[i]; th.d -= move;
        if (th.d < -3) { things.splice(i, 1); continue; }
        if (th.hit || th.d > 0.9 || th.d < -0.9 || Math.abs(th.lane - laneX) > 0.5) continue;
        if (th.kind === 'coin') { th.hit = true; bonus += 2; }
        else if (th.kind === 'word') {
          // Words floating above a rock need a jump; words on open track are free.
          const floating = things.some((o2) => o2 !== th && o2.kind === 'rock' && o2.lane === th.lane && Math.abs(o2.d - th.d) < 0.05);
          if (floating && air < 0.4) continue;
          th.hit = true; bonus += 15; flash = 0.4;
          if (phrase.collect(th.w!)) { bonus += 60; g.phraseDone = true; }
        } else if (th.kind === 'rock' && air > 0.35) continue;
        else if (th.kind === 'beam' && slideT > 0) continue;
        else { g.over = true; }
      }
      g.score = Math.floor(dist) + bonus;
    },
    draw(ctx) {
      // Sky + far hills
      const sg = ctx.createLinearGradient(0, 0, 0, HORIZON);
      sg.addColorStop(0, t.sky[0]); sg.addColorStop(1, t.sky[1]);
      ctx.fillStyle = sg; ctx.fillRect(0, 0, W, HORIZON + 2);
      ctx.fillStyle = t.ground; ctx.fillRect(0, HORIZON, W, H - HORIZON);
      // Track
      const a = proj(-1.5, FAR), b = proj(1.5, FAR), c = proj(1.5, -1.5), d = proj(-1.5, -1.5);
      ctx.fillStyle = t.block[0]; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.fill();
      ctx.globalAlpha = 1;
      // Stripes moving toward you
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      for (let k = -(dist % 4); k < FAR; k += 4) {
        const p1 = proj(-1.5, k), p2 = proj(1.5, k), p3 = proj(1.5, k + 1.6), p4 = proj(-1.5, k + 1.6);
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 2;
      for (const l of [-0.5, 0.5]) { const p = proj(l, FAR), q = proj(l, -1.5); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
      drawAmbient(ctx, t);
      // Side scenery + things, far to near
      const items: { d: number; draw: () => void }[] = [];
      for (const s of sides) items.push({ d: s.d, draw: () => {
        const p = proj(s.side * 2.4, s.d); ctx.font = `${Math.round(70 * p.s)}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText(s.e, p.x, p.y);
      } });
      for (const th of things) if (!th.hit) items.push({ d: th.d, draw: () => drawThing(ctx, th) });
      items.sort((x, y) => y.d - x.d).forEach((it) => { if (it.d > -1.5 && it.d < FAR) it.draw(); });
      // Pet
      const air = jumpT > 0 ? Math.sin((1 - jumpT / JUMP) * Math.PI) : 0;
      const pp = proj(laneX, 0);
      const size = 96, sq = slideT > 0 ? 0.55 : 1;
      ctx.save(); ctx.translate(pp.x, pp.y - air * 90 + Math.abs(Math.sin(dist * 2.2)) * (air ? 0 : 5));
      if (g.over) ctx.rotate(Math.min(1.4, crash * 4));
      if (flash > 0) { ctx.shadowColor = '#ffd23d'; ctx.shadowBlur = 30; }
      ctx.drawImage(pet, -size / 2, -size * sq, size, size * sq); ctx.restore();
      hud(ctx, g.score, t, g.started ? undefined : 'Swipe ← → to switch lanes, ↑ jump, ↓ slide');
      phrase.drawBanner(ctx, 108);
      phrase.drawCelebration(ctx);

      function drawThing(c: CanvasRenderingContext2D, th: Thing) {
        const p = proj(th.lane, th.d);
        c.textAlign = 'center'; c.textBaseline = 'alphabetic';
        if (th.kind === 'rock') { c.font = `${Math.round(80 * p.s)}px serif`; c.fillText('🪨', p.x, p.y + 6 * p.s); }
        else if (th.kind === 'coin') { c.font = `${Math.round(50 * p.s)}px serif`; c.fillText(th.e!, p.x, p.y - 20 * p.s); }
        else if (th.kind === 'beam') {
          c.fillStyle = '#8a5a3a'; const w = LANE * p.s * 0.95, top = p.y - 120 * p.s;
          c.fillRect(p.x - w / 2, top, w, 26 * p.s); c.fillStyle = '#5a3a24';
          c.fillRect(p.x - w / 2, top, 8 * p.s, 120 * p.s); c.fillRect(p.x + w / 2 - 8 * p.s, top, 8 * p.s, 120 * p.s);
          c.fillStyle = '#ffffff'; c.font = `900 ${Math.round(16 * p.s)}px Nunito, system-ui, sans-serif`; c.fillText('↓ slide', p.x, top + 19 * p.s);
        } else if (th.kind === 'wall') {
          const w = LANE * p.s * 0.95, h = 150 * p.s;
          c.fillStyle = t.block[2 % t.block.length]; c.beginPath(); c.roundRect(p.x - w / 2, p.y - h, w, h, 8 * p.s); c.fill();
          c.fillStyle = 'rgba(255,255,255,.3)'; c.font = `${Math.round(40 * p.s)}px serif`; c.fillText('🧱', p.x, p.y - h / 2 + 14 * p.s);
        } else {
          const floating = things.some((o2) => o2 !== th && o2.kind === 'rock' && o2.lane === th.lane && Math.abs(o2.d - th.d) < 0.05);
          bigWord(c, phrase.words[th.w!], p.x, p.y - (floating ? 150 : 45) * p.s, Math.max(0.35, p.s));
        }
      }
    },
  };
  return g;
}
