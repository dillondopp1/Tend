import { W, H, type Game, type GameOpts, themeFor, petImage, sky, roundRect, hud, motifs, rand, Phrase } from './engine';

// Angry-Birds style, played sideways (landscape stage 800x450): the towers stand far across the field.
// drag your pet back on the slingshot and let go. Knock out every word block
// (each level spells the whole key phrase) before you run out of shots. Blocks above fall down.
const BS = 36, R = 22, MAXPULL = 120, POWER = 7.4, GRAV = 620;
interface Block { y: number; vy: number; word?: number; e: string; c: string }
interface Column { x: number; blocks: Block[] }
interface Debris { x: number; y: number; vx: number; vy: number; rot: number; vr: number; b: Block }

export function createLaunch(o: GameOpts): Game {
  const GROUND = H - 56, SX = 96, SY = GROUND - 100;
  const t = themeFor(o.palette);
  const pet = petImage(o.species, o.variant);
  const phrase = new Phrase(o.phrase, o.phraseRef);
  const deco = motifs(o.motifs);
  let level = 0, shots = 0, cols: Column[] = [], debris: Debris[] = [], toast = '', toastT = 0;
  let aim: { x: number; y: number } | null = null;
  let ball: { x: number; y: number; vx: number; vy: number; life: number } | null = null;
  let between = 0;

  function build() {
    level++;
    const n = phrase.words.length;
    const nCols = Math.min(3, 2 + Math.floor(level / 2));
    const xs = Array.from({ length: nCols }, (_, i) => W - 60 - i * 74);
    cols = xs.map((x) => ({ x, blocks: [] as Block[] }));
    const total = n + Math.min(8, 3 + level * 2);
    for (let k = 0; k < total; k++) {
      const col = cols[k % nCols];
      if (col.blocks.length >= 7) continue;
      col.blocks.push({ y: GROUND - (col.blocks.length + 1) * BS, vy: 0, e: deco[k % deco.length], c: t.block[k % t.block.length] });
    }
    // Hide the phrase words through the towers (never all at the bottom).
    const slots = cols.flatMap((c) => c.blocks.map((b, i) => ({ b, i }))).sort((a, b) => b.i - a.i + rand(-1.5, 1.5));
    for (let w = 0; w < n && w < slots.length; w++) slots[w].b.word = phrase.next();
    shots = 3 + Math.ceil(n / 2);
    toast = level === 1 ? 'Knock out the words!' : `Level ${level}!`; toastT = 1.4;
  }
  build();

  const wordsLeft = () => cols.some((c) => c.blocks.some((b) => b.word !== undefined));

  function finishShot() {
    ball = null;
    if (!wordsLeft()) {
      g.score += 25 + shots * 10;
      between = 1.2; toast = shots ? `Level clear! +${shots} shots bonus` : 'Level clear!'; toastT = 1.4;
      return;
    }
    if (shots <= 0) g.over = true;
  }

  const g: Game = {
    over: false, started: false, score: 0, phraseDone: false,
    press(x, y) {
      if (g.over || ball || between > 0 || shots <= 0) return;
      if (Math.hypot(x - SX, y - SY) < 90 || x < W * 0.45) { g.started = true; aim = { x, y }; }
    },
    move(x, y) { if (aim) aim = { x, y }; },
    release() {
      if (!aim) return;
      let dx = SX - aim.x, dy = SY - aim.y;
      const len = Math.hypot(dx, dy);
      aim = null;
      if (len < 18) return; // a tap, not a pull
      if (len > MAXPULL) { dx *= MAXPULL / len; dy *= MAXPULL / len; }
      ball = { x: SX, y: SY, vx: dx * POWER, vy: dy * POWER, life: 0 };
      shots--;
    },
    step(dt) {
      phrase.step(dt); toastT = Math.max(0, toastT - dt);
      if (between > 0) { between -= dt; if (between <= 0) build(); }
      // Blocks settle down their columns.
      for (const c of cols) c.blocks.forEach((b, i) => {
        const target = GROUND - (i + 1) * BS;
        if (b.y < target) { b.vy += GRAV * 1.6 * dt; b.y = Math.min(target, b.y + b.vy * dt); } else { b.y = target; b.vy = 0; }
      });
      for (let i = debris.length - 1; i >= 0; i--) {
        const d = debris[i]; d.vy += GRAV * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.vr * dt;
        if (d.y > H + 60 || d.x > W + 60 || d.x < -60) debris.splice(i, 1);
      }
      if (!ball) return;
      ball.life += dt;
      ball.vy += GRAV * dt; ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      if (ball.y > GROUND - R) { ball.y = GROUND - R; ball.vy *= -0.3; ball.vx *= 0.8; }
      for (const c of cols) {
        for (let i = c.blocks.length - 1; i >= 0; i--) {
          const b = c.blocks[i];
          const half = b.word !== undefined ? BS / 2 + 14 : BS / 2;
          const nx = Math.max(c.x - half, Math.min(ball.x, c.x + half));
          const ny = Math.max(b.y, Math.min(ball.y, b.y + BS));
          if (Math.hypot(ball.x - nx, ball.y - ny) > R) continue;
          c.blocks.splice(i, 1);
          debris.push({ x: c.x, y: b.y + BS / 2, vx: ball.vx * 0.6 + rand(-60, 60), vy: ball.vy * 0.5 - rand(150, 300), rot: 0, vr: rand(-8, 8), b });
          g.score += 5;
          if (b.word !== undefined) {
            g.score += 20; toast = `“${phrase.words[b.word]}”`; toastT = 1;
            if (phrase.collect(b.word)) { g.score += 50; g.phraseDone = true; }
          }
          ball.vx *= 0.72; ball.vy *= 0.85;
        }
      }
      const slow = Math.hypot(ball.vx, ball.vy) < 40 && ball.y >= GROUND - R - 1;
      if (ball.x > W + 40 || ball.x < -40 || slow || ball.life > 5) finishShot();
    },
    draw(ctx) {
      sky(ctx, t);
      ctx.fillStyle = t.ground; ctx.fillRect(0, GROUND, W, H - GROUND);
      // Slingshot
      ctx.strokeStyle = '#6b4226'; ctx.lineWidth = 9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(SX, GROUND); ctx.lineTo(SX, SY + 28); ctx.lineTo(SX - 18, SY - 6); ctx.moveTo(SX, SY + 28); ctx.lineTo(SX + 18, SY - 6); ctx.stroke();
      const pull = aim ? (() => {
        let dx = aim.x - SX, dy = aim.y - SY; const len = Math.hypot(dx, dy);
        if (len > MAXPULL) { dx *= MAXPULL / len; dy *= MAXPULL / len; }
        return { x: SX + dx, y: SY + dy };
      })() : null;
      if (pull) {
        ctx.strokeStyle = '#3b2a2a'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(SX - 18, SY - 6); ctx.lineTo(pull.x, pull.y); ctx.lineTo(SX + 18, SY - 6); ctx.stroke();
        // Trajectory preview
        let px = SX, py = SY, vx = (SX - pull.x) * POWER, vy = (SY - pull.y) * POWER;
        ctx.fillStyle = 'rgba(255,255,255,.85)';
        for (let k = 0; k < 16; k++) { for (let s = 0; s < 4; s++) { vy += GRAV * 0.016; px += vx * 0.016; py += vy * 0.016; } ctx.beginPath(); ctx.arc(px, py, 3.5 - k * 0.15, 0, 7); ctx.fill(); }
      }
      // Towers
      for (const c of cols) for (const b of c.blocks) drawBlock(ctx, b, c.x, b.y + BS / 2, 0);
      for (const d of debris) drawBlock(ctx, d.b, d.x, d.y, d.rot);
      // Pet: on the sling, flying, or waiting
      const pp = ball ?? pull ?? (shots > 0 && !g.over ? { x: SX, y: SY } : null);
      if (pp) ctx.drawImage(pet, pp.x - R * 1.7, pp.y - R * 1.8, R * 3.4, R * 3.4);
      // Shots left
      ctx.font = '22px serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      for (let k = 0; k < Math.max(0, shots - (ball || pull ? 0 : 1)); k++) ctx.drawImage(pet, 12 + k * 26, GROUND + 18, 30, 30);
      hud(ctx, g.score, t, g.started ? undefined : 'Pull your pet back and let go!');
      phrase.drawBanner(ctx, 108);
      if (toastT > 0) { ctx.textAlign = 'center'; ctx.fillStyle = t.ink; ctx.font = '900 22px Nunito, system-ui, sans-serif'; ctx.fillText(toast, W / 2, 160); }
      phrase.drawCelebration(ctx);

      function drawBlock(c: CanvasRenderingContext2D, b: Block, x: number, y: number, rot: number) {
        c.save(); c.translate(x, y); c.rotate(rot);
        if (b.word !== undefined) {
          c.fillStyle = '#ffffff'; roundRect(c, -BS / 2 - 14, -BS / 2, BS + 28, BS - 2, 9);
          c.strokeStyle = '#ffb43d'; c.lineWidth = 3; c.beginPath(); c.roundRect(-BS / 2 - 14, -BS / 2, BS + 28, BS - 2, 9); c.stroke();
          c.fillStyle = '#5b3fe0'; c.textAlign = 'center'; c.textBaseline = 'middle';
          let size = 15; c.font = `900 ${size}px Nunito, system-ui, sans-serif`;
          const w = phrase.words[b.word];
          while (c.measureText(w).width > BS + 22 && size > 9) { size--; c.font = `900 ${size}px Nunito, system-ui, sans-serif`; }
          c.fillText(w, 0, 0);
        } else {
          c.fillStyle = b.c; roundRect(c, -BS / 2, -BS / 2, BS, BS - 2, 7);
          c.font = '18px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(b.e, 0, 0);
        }
        c.restore();
      }
    },
  };
  return g;
}
