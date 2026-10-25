import { W, H, type Game, type GameOpts, themeFor, petImage, sky, roundRect, word, hud, Phrase, rand, motifs } from './engine';

// Flappy-style: tap to flap through gaps. Each gap = 1 point; key-phrase words float in some gaps (+1 each).
export function createGlide(o: GameOpts): Game {
  const t = themeFor(o.palette);
  const pet = petImage(o.species, o.variant);
  const phrase = new Phrase(o.phrase, o.phraseRef, o.phraseMeaning);
  const words = phrase.words;
  const deco = motifs(o.motifs);
  const R = 24, GAP = 170, PW = 64, SPEED = 150;
  let y = H * 0.42, vy = 0, rot = 0, dist = 0, flash = 0;
  const pipes: { x: number; gapY: number; passed: boolean; word?: number; wordGot?: boolean }[] = [];
  const clouds = Array.from({ length: 5 }, () => ({ x: rand(0, W), y: rand(40, H - 160), e: deco[Math.floor(rand(0, deco.length))], s: rand(18, 30) }));

  const g: Game = {
    over: false, started: false, score: 0, phraseDone: false,
    press() {
      if (g.over) return;
      g.started = true; vy = -330;
    },
    step(dt) {
      phrase.step(dt);
      if (!g.started || g.over) { rot = Math.sin(performance.now() / 300) * 0.1; y = H * 0.42 + Math.sin(performance.now() / 300) * 8; return; }
      const speed = SPEED + Math.min(70, g.score * 2);
      vy += 980 * dt; y += vy * dt; rot = Math.max(-0.5, Math.min(1.1, vy / 600));
      dist += speed * dt; flash = Math.max(0, flash - dt);
      for (const c of clouds) { c.x -= speed * 0.25 * dt; if (c.x < -30) { c.x = W + 30; c.y = rand(40, H - 160); } }
      if (!pipes.length || pipes[pipes.length - 1].x < W - 210) {
        const p: (typeof pipes)[number] = { x: W + 20, gapY: rand(140, H - 150 - GAP), passed: false };
        if (pipes.length % 2 === 1) p.word = phrase.next();
        pipes.push(p);
      }
      for (const p of pipes) {
        p.x -= speed * dt;
        const px = 90;
        if (!p.passed && p.x + PW < px - R) { p.passed = true; g.score += 1; }
        if (p.word !== undefined && !p.wordGot && Math.abs(p.x + PW / 2 - px) < 30 && Math.abs(p.gapY + GAP / 2 - y) < 40) {
          p.wordGot = true; g.score += 1; flash = 0.4;
          if (phrase.collect(p.word)) { g.phraseDone = true; g.score += 3; }
        }
        if (px + R - 6 > p.x && px - R + 6 < p.x + PW && (y - R + 6 < p.gapY || y + R - 6 > p.gapY + GAP)) g.over = true;
      }
      while (pipes.length && pipes[0].x < -PW - 10) {
        pipes.shift();
      }
      if (y + R > H - 50 || y < -40) g.over = true;
    },
    draw(ctx) {
      sky(ctx, t);
      ctx.font = '28px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = 0.45; for (const c of clouds) { ctx.font = `${c.s}px serif`; ctx.fillText(c.e, c.x, c.y); } ctx.globalAlpha = 1;
      pipes.forEach((p, i) => {
        ctx.fillStyle = t.block[i % t.block.length];
        roundRect(ctx, p.x, -20, PW, p.gapY + 20, 18);
        roundRect(ctx, p.x, p.gapY + GAP, PW, H, 18);
        ctx.fillStyle = 'rgba(255,255,255,.35)';
        roundRect(ctx, p.x + 8, -20, 10, p.gapY + 10, 5); roundRect(ctx, p.x + 8, p.gapY + GAP + 10, 10, H, 5);
        if (p.word !== undefined && !p.wordGot) word(ctx, words[p.word], p.x + PW / 2, p.gapY + GAP / 2);
      });
      ctx.fillStyle = t.ground; ctx.fillRect(0, H - 50, W, 50);
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      for (let x = -(dist % 40); x < W; x += 40) ctx.fillRect(x, H - 50, 20, 6);
      ctx.save(); ctx.translate(90, y); ctx.rotate(rot);
      if (flash > 0) { ctx.shadowColor = '#ffd23d'; ctx.shadowBlur = 30; }
      ctx.drawImage(pet, -R * 1.6, -R * 1.7, R * 3.2, R * 3.2); ctx.restore();
      hud(ctx, g.score, t, g.started ? undefined : 'Tap to flap!');
      phrase.drawBanner(ctx, 100);
    },
  };
  return g;
}
