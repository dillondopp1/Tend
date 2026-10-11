import { W, H, type Game, type GameOpts, themeFor, petImage, sky, roundRect, hud, Phrase } from './engine';

// Tap to drop the sliding block; overhang is trimmed. Every 5th block carries the next key-phrase word.
export function createStack(o: GameOpts): Game {
  const t = themeFor(o.palette);
  const pet = petImage(o.species, o.variant);
  const phrase = new Phrase(o.phrase, o.phraseRef);
  const words = phrase.words;
  const BH = 34, BASE_Y = H - 90;
  type Block = { x: number; w: number; c: string; word?: number };
  const blocks: Block[] = [{ x: W / 2 - 80, w: 160, c: t.block[0] }];
  let cur: Block & { dir: number } = { x: 0, w: 160, c: t.block[1], dir: 1 };
  let camY = 0, chip: { x: number; y: number; w: number; vy: number; c: string } | null = null, perfect = 0;

  function newBlock() {
    const top = blocks[blocks.length - 1];
    const n = blocks.length;
    cur = { x: n % 2 ? -top.w * 0.5 : W - top.w * 0.5, w: top.w, c: t.block[n % t.block.length], dir: n % 2 ? 1 : -1 };
    if (n % 3 === 0) cur.word = phrase.next();
  }

  const g: Game = {
    over: false, started: false, score: 0, phraseDone: false,
    press() {
      if (g.over) return;
      if (!g.started) { g.started = true; newBlock(); return; }
      const top = blocks[blocks.length - 1];
      let left = Math.max(cur.x, top.x), right = Math.min(cur.x + cur.w, top.x + top.w);
      if (right - left <= 4) { g.over = true; chip = { x: cur.x, y: 0, w: cur.w, vy: 0, c: cur.c }; return; }
      if (Math.abs(cur.x - top.x) < 6) { left = top.x; right = top.x + top.w; perfect = 0.6; } // snap: perfect drop
      else {
        const cx = cur.x < top.x ? cur.x : right;
        chip = { x: cx, y: 0, w: cur.w - (right - left), vy: 0, c: cur.c };
      }
      blocks.push({ x: left, w: right - left, c: cur.c, word: cur.word });
      if (cur.word !== undefined) {
        if (phrase.collect(cur.word)) { g.phraseDone = true; g.score += 3; }
      }
      g.score += 1;
      newBlock();
    },
    step(dt) {
      phrase.step(dt);
      perfect = Math.max(0, perfect - dt);
      const targetCam = Math.max(0, (blocks.length - 8) * BH);
      camY += (targetCam - camY) * Math.min(1, dt * 5);
      if (chip) { chip.vy += 900 * dt; chip.y += chip.vy * dt; if (chip.y > H) chip = null; }
      if (!g.started || g.over) return;
      const speed = 150 + Math.min(220, blocks.length * 9);
      cur.x += cur.dir * speed * dt;
      if (cur.x + cur.w > W + 40) cur.dir = -1;
      if (cur.x < -40) cur.dir = 1;
    },
    draw(ctx) {
      sky(ctx, t);
      ctx.save(); ctx.translate(0, camY);
      ctx.fillStyle = t.ground; ctx.fillRect(0, BASE_Y + BH, W, 400);
      blocks.forEach((b, i) => drawBlock(ctx, b, BASE_Y - i * BH));
      const topY = BASE_Y - (blocks.length - 1) * BH;
      const top = blocks[blocks.length - 1];
      if (g.started && !g.over) drawBlock(ctx, cur, topY - BH);
      if (chip) { ctx.fillStyle = chip.c; roundRect(ctx, chip.x, topY - BH + chip.y, chip.w, BH - 3, 8); }
      const ps = 74;
      ctx.drawImage(pet, top.x + top.w / 2 - ps / 2, topY - ps + 8 - (g.started && !g.over ? BH : 0), ps, ps);
      ctx.restore();
      hud(ctx, g.score, t, !g.started ? 'Tap to drop each block. Stack it high!' : perfect > 0 ? 'Perfect! ✨' : undefined);
      phrase.drawBanner(ctx, 108);
      phrase.drawCelebration(ctx);

      function drawBlock(c: CanvasRenderingContext2D, b: Block, y: number) {
        c.fillStyle = b.c; roundRect(c, b.x, y, b.w, BH - 3, 8);
        c.fillStyle = 'rgba(255,255,255,.3)'; roundRect(c, b.x + 6, y + 4, Math.max(0, b.w - 12), 6, 3);
        if (b.word !== undefined) {
          c.fillStyle = '#ffffff'; c.font = '900 15px Nunito, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText(words[b.word], b.x + b.w / 2, y + BH / 2);
        }
      }
    },
  };
  return g;
}
