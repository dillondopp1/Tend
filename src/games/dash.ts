import { W, H, type Game, type GameOpts, themeFor, petImage, sky, word, hud, Phrase, rand, motifs } from './engine';

// Dino-runner: the pet runs on its own. Tap to jump, hold for a higher jump. Hop over the stones,
// grab key-phrase words floating in the air. Score = distance, speed ramps up.
export function createDash(o: GameOpts): Game {
  const t = themeFor(o.palette);
  const pet = petImage(o.species, o.variant);
  const phrase = new Phrase(o.phrase, o.phraseRef, o.phraseMeaning);
  const words = phrase.words;
  const deco = motifs(o.motifs);
  const GROUND = H - 120, PX = 80, PS = 70;
  let y = 0, vy = 0, holding = false, holdT = 0, onGround = true;
  let speed = 230, dist = 0, bonus = 0, spawnIn = 1.2, flash = 0, squash = 0;
  const obs: { x: number; w: number; h: number; e: string }[] = [];
  const floaters: { x: number; y: number; w: number }[] = [];
  const hills = Array.from({ length: 4 }, (_, i) => ({ x: i * 120, e: deco[i % deco.length] }));
  const OBST = ['🪨', '🌵', '🪵'];

  const jump = () => { if (onGround) { vy = -620; onGround = false; holdT = 0; squash = 0.15; } };

  const g: Game = {
    over: false, started: false, score: 0, phraseDone: false,
    press() { if (g.over) return; g.started = true; holding = true; jump(); },
    release() { holding = false; },
    step(dt) {
      phrase.step(dt);
      squash = Math.max(0, squash - dt); flash = Math.max(0, flash - dt);
      if (!g.started || g.over) return;
      speed = Math.min(560, speed + 9 * dt);
      dist += speed * dt;
      // Holding extends the jump for up to 0.22 s: a lighter gravity while rising.
      if (!onGround) {
        holdT += dt;
        const lift = holding && vy < 0 && holdT < 0.22;
        vy += (lift ? 900 : 2300) * dt;
        y += vy * dt;
        if (y >= 0) { y = 0; vy = 0; onGround = true; squash = 0.12; }
      }
      for (const h of hills) { h.x -= speed * 0.2 * dt; if (h.x < -60) h.x += 480; }
      spawnIn -= dt;
      if (spawnIn <= 0) {
        const big = Math.random() < Math.min(0.45, dist / 12000);
        obs.push({ x: W + 30, w: big ? 46 : 34, h: big ? 56 : 40, e: OBST[Math.floor(rand(0, OBST.length))] });
        if (Math.random() < 0.6) floaters.push({ x: W + 30 + rand(110, 170), y: GROUND - rand(120, 170), w: phrase.next() });
        spawnIn = rand(0.85, 1.6) * (300 / speed) + 0.45;
      }
      const py = GROUND + y;
      for (let i = obs.length - 1; i >= 0; i--) {
        const ob = obs[i]; ob.x -= speed * dt;
        if (ob.x + ob.w < -10) { obs.splice(i, 1); continue; }
        // Forgiving hitbox: the pet's body is narrower than its picture.
        if (PX + 20 > ob.x + 6 && PX - 20 < ob.x + ob.w - 6 && py > GROUND - ob.h + 10) g.over = true;
      }
      for (let i = floaters.length - 1; i >= 0; i--) {
        const f = floaters[i]; f.x -= speed * dt;
        if (Math.abs(f.x - PX) < 40 && Math.abs(f.y - (py - PS / 2)) < 44) {
          floaters.splice(i, 1); bonus += 8; flash = 0.4;
          if (phrase.collect(f.w)) { g.phraseDone = true; bonus += 15; }
        } else if (f.x < -60) floaters.splice(i, 1);
      }
      g.score = Math.floor(dist / 20) + bonus;
    },
    draw(ctx) {
      sky(ctx, t);
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.globalAlpha = 0.35; ctx.font = '64px serif';
      for (const h of hills) ctx.fillText(h.e, h.x, GROUND - 40);
      ctx.globalAlpha = 1;
      ctx.fillStyle = t.ground; ctx.fillRect(0, GROUND, W, H - GROUND);
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      for (let x = -(dist % 48); x < W; x += 48) ctx.fillRect(x, GROUND + 8, 24, 5);
      for (const ob of obs) { ctx.font = `${ob.h + 6}px serif`; ctx.fillText(ob.e, ob.x + ob.w / 2, GROUND + 6); }
      for (const f of floaters) word(ctx, words[f.w], f.x, f.y);
      const py = GROUND + y;
      const sx = 1 + squash * 1.5, sy = 1 - squash * 1.5;
      const bob = onGround && g.started && !g.over ? Math.abs(Math.sin(dist / 30)) * 4 : 0;
      ctx.save(); ctx.translate(PX, py - bob);
      if (flash > 0) { ctx.shadowColor = '#ffd23d'; ctx.shadowBlur = 30; }
      ctx.drawImage(pet, -PS / 2 * sx - 6, -PS * sy - 4, PS * sx + 12, PS * sy + 12); ctx.restore();
      hud(ctx, g.score, t, g.started ? undefined : 'Tap to jump. Hold for a big jump!');
      phrase.drawBanner(ctx, 100);
      phrase.drawCelebration(ctx);
    },
  };
  return g;
}
