import { W, H, type Game, type GameOpts, themeFor, petImage, sky, roundRect, hud, rand, Phrase } from './engine';

// Angry-Birds style, played sideways (landscape stage 800x450). Pull your pet back and let go: no aiming
// guide, just the band. Towers are built from stone (2 hits), wood and glass, with planks across gaps,
// roofs on top and TNT inside that blows up its neighbours (and other TNT). Every third shot is a bomb:
// it explodes on contact, or tap the screen mid-flight to set it off. Knock out every phrase word to
// clear the level.
const BW = 44, BH = 30, BEAMH = 14, R = 22, MAXPULL = 120, POWER = 7.4, GRAV = 620;
const TNT_R = 95, BOMB_R = 115;

type Mat = 'stone' | 'wood' | 'glass' | 'tnt' | 'roof';
interface Block { y: number; vy: number; mat: Mat; hp: number; word?: number }
interface Column { x: number; blocks: Block[] }
interface Beam { a: number; b: number; level: number; word?: number; broken?: boolean }
interface Debris { x: number; y: number; vx: number; vy: number; rot: number; vr: number; block?: Block; beamW?: number; word?: number }
interface Particle { x: number; y: number; vx: number; vy: number; t: number; c: string; s: number }
interface Template { h: number[]; gap: number; beams: [number, number, number][]; roofs: number[] }

const TEMPLATES: Template[] = [
  { h: [6, 3, 3, 3, 6], gap: 0, beams: [[1, 3, 3]], roofs: [0, 4] },                 // castle with a gate
  { h: [2, 3, 4, 5, 4, 3, 2], gap: 0, beams: [], roofs: [3] },                        // pyramid
  { h: [7, 3, 3, 7], gap: 14, beams: [[1, 2, 3]], roofs: [0, 3] },                    // twin towers
  { h: [4, 4, 1, 4, 4], gap: 6, beams: [[0, 1, 4], [3, 4, 4], [1, 3, 4]], roofs: [] }, // bridge
  { h: [5, 2, 2, 2, 5], gap: 4, beams: [[0, 4, 5]], roofs: [2] },                    // fort under a long plank
  { h: [1, 2, 3, 4, 5, 6], gap: 0, beams: [], roofs: [5] },                           // staircase
];

const MAT_COLOR: Record<Mat, string> = { stone: '#9aa3b5', wood: '#c98a52', glass: 'rgba(170,220,255,.75)', tnt: '#e5484d', roof: '#7c5cff' };

export function createLaunch(o: GameOpts): Game {
  const GROUND = H - 56, SX = 96, SY = GROUND - 100;
  const t = themeFor(o.palette);
  const pet = petImage(o.species, o.variant);
  const phrase = new Phrase(o.phrase, o.phraseRef, o.phraseMeaning);
  let level = 0, cols: Column[] = [], beams: Beam[] = [], ammo: ('pet' | 'bomb')[] = [];
  const debris: Debris[] = [], parts: Particle[] = [], rings: { x: number; y: number; r: number; t: number }[] = [];
  const pending: { x: number; y: number; r: number; t: number }[] = [];
  let aim: { x: number; y: number } | null = null;
  let ball: { x: number; y: number; vx: number; vy: number; life: number; bomb: boolean } | null = null;
  let between = 0, settle = 0, shake = 0, toast = '', toastT = 0, shotsFired = 0, bombHint = false;

  const solidHeight = (c: Column) => c.blocks.filter((b) => b.mat !== 'roof').length;
  const beamY = (b: Beam) => GROUND - b.level * BH - BEAMH;
  const beamX = (b: Beam) => [cols[b.a].x - BW / 2, cols[b.b].x + BW / 2] as const;

  function build() {
    level++;
    const tpl = level === 1 ? TEMPLATES[0] : TEMPLATES[Math.floor(rand(0, TEMPLATES.length))];
    const width = tpl.h.length * BW + (tpl.h.length - 1) * tpl.gap;
    const x0 = W - 34 - width + BW / 2;
    cols = tpl.h.map((h, i) => {
      const blocks: Block[] = [];
      for (let k = 0; k < h; k++) {
        const mat: Mat = k === 0 || k < h * 0.35 ? 'stone' : k === h - 1 && h >= 4 ? 'glass' : 'wood';
        blocks.push({ y: GROUND - (k + 1) * BH, vy: 0, mat, hp: mat === 'stone' ? 2 : 1 });
      }
      return { x: x0 + i * (BW + tpl.gap), blocks };
    });
    beams = tpl.beams.map(([a, b, lv]) => ({ a, b, level: lv }));
    for (const r of tpl.roofs) cols[r].blocks.push({ y: GROUND - (cols[r].blocks.length + 1) * BH, vy: 0, mat: 'roof', hp: 1 });
    // TNT tucked into the middle of the towers.
    const mids = cols.flatMap((c) => c.blocks.map((b, k) => ({ b, k, n: solidHeight(c) })))
      .filter(({ b, k, n }) => b.mat !== 'roof' && k > 0 && k < n - 1).sort(() => Math.random() - 0.5);
    mids.slice(0, Math.min(3, 1 + Math.floor(level / 2))).forEach(({ b }) => { b.mat = 'tnt'; b.hp = 1; });
    // The phrase words hide in blocks and planks, spread through the structure.
    const slots: { word?: number }[] = [
      ...cols.flatMap((c) => c.blocks.filter((b) => b.mat !== 'tnt' && b.mat !== 'roof')),
      ...beams,
    ].sort(() => Math.random() - 0.5);
    for (let w = 0; w < phrase.words.length && w < slots.length; w++) slots[w].word = phrase.next();
    const n = phrase.words.length;
    ammo = Array.from({ length: 4 + Math.ceil(n / 2) }, (_, i) => ((shotsFired + i + 1) % 3 === 0 ? 'bomb' : 'pet'));
    toast = level === 1 ? 'Knock out the words!' : `Level ${level}!`; toastT = 1.4;
  }
  build();

  const wordsLeft = () => cols.some((c) => c.blocks.some((b) => b.word !== undefined)) || beams.some((b) => !b.broken && b.word !== undefined);

  function burst(x: number, y: number, c: string, n: number, speed = 220) {
    for (let k = 0; k < n; k++) {
      const a = rand(0, Math.PI * 2), v = rand(0.3, 1) * speed;
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, t: rand(0.4, 0.9), c, s: rand(2, 5) });
    }
  }

  function collect(word: number | undefined, x: number, y: number) {
    if (word === undefined) return;
    g.score += 20; toast = `“${phrase.words[word]}”`; toastT = 1;
    burst(x, y, '#ffd23d', 14);
    if (phrase.collect(word)) { g.score += 50; g.phraseDone = true; }
  }

  function breakBlock(ci: number, k: number, vx: number, vy: number) {
    const c = cols[ci], b = c.blocks[k];
    c.blocks.splice(k, 1);
    const y = b.y + BH / 2;
    debris.push({ x: c.x, y, vx: vx + rand(-60, 60), vy: vy - rand(120, 260), rot: 0, vr: rand(-8, 8), block: b });
    g.score += b.mat === 'stone' ? 8 : 5;
    if (b.mat === 'glass') burst(c.x, y, '#bfe6ff', 10, 160);
    if (b.mat === 'tnt') pending.push({ x: c.x, y, r: TNT_R, t: 0.12 });
    collect(b.word, c.x, y);
  }

  function breakBeam(bm: Beam, vx: number, vy: number) {
    if (bm.broken) return;
    bm.broken = true;
    const [x1, x2] = beamX(bm);
    debris.push({ x: (x1 + x2) / 2, y: beamY(bm) + BEAMH / 2, vx: vx * 0.3, vy: vy * 0.3 - 80, rot: 0, vr: rand(-2, 2), beamW: x2 - x1, word: bm.word });
    g.score += 5;
    collect(bm.word, (x1 + x2) / 2, beamY(bm));
  }

  function explode(x: number, y: number, r: number) {
    rings.push({ x, y, r, t: 0.45 }); shake = 0.35;
    burst(x, y, '#ffb43d', 26, 340); burst(x, y, '#ff6b3d', 18, 260); burst(x, y, '#5a4a46', 10, 180);
    cols.forEach((c, ci) => {
      for (let k = c.blocks.length - 1; k >= 0; k--) {
        const b = c.blocks[k], by = b.y + BH / 2;
        const d = Math.hypot(c.x - x, by - y);
        if (d > r) continue;
        const push = (1 - d / r) * 520, dir = Math.atan2(by - y, c.x - x);
        b.hp -= b.mat === 'stone' && d > r * 0.5 ? 1 : 2;
        if (b.hp <= 0) breakBlock(ci, k, Math.cos(dir) * push, Math.sin(dir) * push);
      }
    });
    for (const bm of beams) {
      if (bm.broken) continue;
      const [x1, x2] = beamX(bm), by = beamY(bm) + BEAMH / 2;
      const nx = Math.max(x1, Math.min(x, x2));
      if (Math.hypot(nx - x, by - y) <= r) breakBeam(bm, (nx - x) * 3, -200);
    }
  }

  function endShot() { ball = null; settle = 0.9; }

  function finishShot() {
    if (!wordsLeft()) {
      const left = ammo.length;
      g.score += 25 + left * 10;
      between = 1.3; toast = left ? `Level clear! +${left} shots bonus` : 'Level clear!'; toastT = 1.4;
      return;
    }
    if (!ammo.length) g.over = true;
  }

  const g: Game = {
    over: false, started: false, score: 0, phraseDone: false,
    press(x, y) {
      if (g.over) return;
      if (ball?.bomb) { explode(ball.x, ball.y, BOMB_R); endShot(); return; } // tap mid-air: boom
      if (ball || settle > 0 || between > 0 || !ammo.length) return;
      if (Math.hypot(x - SX, y - SY) < 110 || x < W * 0.4) { g.started = true; aim = { x, y }; }
    },
    move(x, y) { if (aim) aim = { x, y }; },
    release() {
      if (!aim) return;
      let dx = SX - aim.x, dy = SY - aim.y;
      const len = Math.hypot(dx, dy);
      aim = null;
      if (len < 18) return; // a tap, not a pull
      if (len > MAXPULL) { dx *= MAXPULL / len; dy *= MAXPULL / len; }
      const kind = ammo.shift()!;
      shotsFired++;
      ball = { x: SX, y: SY, vx: dx * POWER, vy: dy * POWER, life: 0, bomb: kind === 'bomb' };
      if (kind === 'bomb' && !bombHint) { bombHint = true; toast = '💣 Tap to blow it up!'; toastT = 1.6; }
    },
    step(dt) {
      phrase.step(dt); toastT = Math.max(0, toastT - dt); shake = Math.max(0, shake - dt);
      if (between > 0) { between -= dt; if (between <= 0) build(); }
      // Chain reactions
      for (let i = pending.length - 1; i >= 0; i--) {
        pending[i].t -= dt;
        if (pending[i].t <= 0) { const p = pending.splice(i, 1)[0]; explode(p.x, p.y, p.r); }
      }
      // Blocks settle down their columns; planks fall when either support drops below them.
      for (const c of cols) c.blocks.forEach((b, i) => {
        const target = GROUND - (i + 1) * BH;
        if (b.y < target) { b.vy += GRAV * 1.6 * dt; b.y = Math.min(target, b.y + b.vy * dt); } else { b.y = target; b.vy = 0; }
      });
      for (const bm of beams) if (!bm.broken && (solidHeight(cols[bm.a]) < bm.level || solidHeight(cols[bm.b]) < bm.level)) breakBeam(bm, 0, 0);
      for (let i = debris.length - 1; i >= 0; i--) {
        const d = debris[i]; d.vy += GRAV * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.vr * dt;
        if (d.y > H + 80 || d.x > W + 80 || d.x < -80) debris.splice(i, 1);
      }
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.t -= dt; p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.t <= 0) parts.splice(i, 1);
      }
      for (let i = rings.length - 1; i >= 0; i--) { rings[i].t -= dt; if (rings[i].t <= 0) rings.splice(i, 1); }
      if (settle > 0) { settle -= dt; if (settle <= 0) { if (pending.length) settle = 0.2; else finishShot(); } }
      if (!ball) return;

      ball.life += dt;
      ball.vy += GRAV * dt; ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      if (ball.y > GROUND - R) {
        if (ball.bomb) { explode(ball.x, GROUND - 10, BOMB_R); endShot(); return; }
        ball.y = GROUND - R; ball.vy *= -0.3; ball.vx *= 0.8;
      }
      outer: for (let ci = 0; ci < cols.length; ci++) {
        const c = cols[ci];
        for (let k = c.blocks.length - 1; k >= 0; k--) {
          const b = c.blocks[k];
          const nx = Math.max(c.x - BW / 2, Math.min(ball.x, c.x + BW / 2));
          const ny = Math.max(b.y, Math.min(ball.y, b.y + BH));
          if (Math.hypot(ball.x - nx, ball.y - ny) > R) continue;
          if (ball.bomb) { explode(ball.x, ball.y, BOMB_R); endShot(); break outer; }
          const speed = Math.hypot(ball.vx, ball.vy);
          b.hp -= speed > 650 ? 2 : 1;
          if (b.hp > 0) { // stone held: bounce off
            ball.vx *= -0.35; ball.vy *= 0.6; ball.x += Math.sign(ball.vx || -1) * 4;
            burst(nx, ny, '#d6dbe6', 6, 120);
            continue;
          }
          breakBlock(ci, k, ball.vx * 0.6, ball.vy * 0.5);
          const slow = b.mat === 'glass' ? 0.92 : b.mat === 'stone' ? 0.55 : 0.75;
          ball.vx *= slow; ball.vy *= 0.85;
        }
      }
      if (ball) for (const bm of beams) {
        if (bm.broken) continue;
        const [x1, x2] = beamX(bm), by = beamY(bm);
        const nx = Math.max(x1, Math.min(ball.x, x2)), ny = Math.max(by, Math.min(ball.y, by + BEAMH));
        if (Math.hypot(ball.x - nx, ball.y - ny) > R) continue;
        if (ball.bomb) { explode(ball.x, ball.y, BOMB_R); endShot(); break; }
        breakBeam(bm, ball.vx, ball.vy); ball.vx *= 0.8; ball.vy *= 0.7;
      }
      if (!ball) return;
      const slow = Math.hypot(ball.vx, ball.vy) < 40 && ball.y >= GROUND - R - 1;
      if (ball.x > W + 40 || ball.x < -40 || slow || ball.life > 6) endShot();
    },
    draw(ctx) {
      ctx.save();
      if (shake > 0) ctx.translate(rand(-1, 1) * shake * 16, rand(-1, 1) * shake * 16);
      sky(ctx, t);
      ctx.fillStyle = t.ground; ctx.fillRect(-20, GROUND, W + 40, H - GROUND + 20);
      // Slingshot + band (no trajectory guide on purpose)
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
      }
      // Structure
      for (const bm of beams) if (!bm.broken) { const [x1, x2] = beamX(bm); drawBeam(ctx, (x1 + x2) / 2, beamY(bm) + BEAMH / 2, x2 - x1, bm.word, 0); }
      for (const c of cols) for (const b of c.blocks) drawBlock(ctx, b, c.x, b.y + BH / 2, 0);
      for (const d of debris) { if (d.block) drawBlock(ctx, d.block, d.x, d.y, d.rot); else drawBeam(ctx, d.x, d.y, d.beamW!, d.word, d.rot); }
      // Explosions
      for (const r of rings) {
        const k = 1 - r.t / 0.45;
        ctx.globalAlpha = r.t / 0.45; ctx.fillStyle = '#ffd23d';
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r * (0.3 + k * 0.7), 0, 7); ctx.fill();
        ctx.strokeStyle = '#ff6b3d'; ctx.lineWidth = 6; ctx.stroke(); ctx.globalAlpha = 1;
      }
      for (const p of parts) { ctx.globalAlpha = Math.min(1, p.t * 2); ctx.fillStyle = p.c; ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); }
      ctx.globalAlpha = 1;
      // Pet (or bomb) on the sling or in flight
      const next = ammo[0];
      const pp = ball ?? pull ?? (next && !g.over && settle <= 0 && between <= 0 ? { x: SX, y: SY } : null);
      const isBomb = ball ? ball.bomb : next === 'bomb';
      if (pp) {
        ctx.drawImage(pet, pp.x - R * 1.7, pp.y - R * 1.8, R * 3.4, R * 3.4);
        if (isBomb) { ctx.font = '30px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('💣', pp.x + 16, pp.y - 22); }
      }
      // Ammo left
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '22px serif';
      ammo.slice(pp && !ball ? 1 : 0).forEach((a, k) => {
        if (a === 'bomb') ctx.fillText('💣', 24 + k * 30, GROUND + 15);
        else ctx.drawImage(pet, 11 + k * 30, GROUND + 3, 26, 26);
      });
      ctx.restore();
      hud(ctx, g.score, t, g.started ? undefined : 'Pull your pet back and let go!');
      phrase.drawBanner(ctx, 100);
      if (toastT > 0) { ctx.textAlign = 'center'; ctx.fillStyle = t.ink; ctx.font = '900 22px Nunito, system-ui, sans-serif'; ctx.fillText(toast, W / 2, 170); }
      phrase.drawCelebration(ctx);

      function wordLabel(c: CanvasRenderingContext2D, word: number, maxW: number) {
        const w = phrase.words[word];
        let size = 14; c.font = `900 ${size}px Nunito, system-ui, sans-serif`;
        while (c.measureText(w).width > maxW && size > 8) { size--; c.font = `900 ${size}px Nunito, system-ui, sans-serif`; }
        c.fillStyle = '#5b3fe0'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(w, 0, 1);
      }
      function drawBlock(c: CanvasRenderingContext2D, b: Block, x: number, y: number, rot: number) {
        c.save(); c.translate(x, y); c.rotate(rot);
        if (b.mat === 'roof') {
          c.fillStyle = MAT_COLOR.roof; c.beginPath(); c.moveTo(-BW / 2 - 4, BH / 2); c.lineTo(0, -BH / 2 - 6); c.lineTo(BW / 2 + 4, BH / 2); c.fill();
          c.fillStyle = '#ffd23d'; c.fillRect(-1, -BH / 2 - 20, 3, 16); c.fillRect(2, -BH / 2 - 20, 10, 7);
          c.restore(); return;
        }
        if (b.word !== undefined) {
          c.fillStyle = '#ffffff'; roundRect(c, -BW / 2, -BH / 2, BW, BH - 2, 7);
          c.strokeStyle = '#ffb43d'; c.lineWidth = 3; c.beginPath(); c.roundRect(-BW / 2 + 1.5, -BH / 2 + 1.5, BW - 3, BH - 5, 6); c.stroke();
          wordLabel(c, b.word, BW - 8);
        } else {
          c.fillStyle = MAT_COLOR[b.mat]; roundRect(c, -BW / 2, -BH / 2, BW, BH - 2, b.mat === 'glass' ? 3 : 6);
          if (b.mat === 'stone') {
            c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-BW / 2 + 6, -2); c.lineTo(BW / 2 - 6, -2); c.stroke();
            if (b.hp < 2) { c.beginPath(); c.moveTo(-8, -BH / 2 + 3); c.lineTo(2, 0); c.lineTo(-4, BH / 2 - 4); c.stroke(); }
          }
          if (b.mat === 'wood') { c.strokeStyle = 'rgba(90,50,20,.35)'; c.lineWidth = 2; c.strokeRect(-BW / 2 + 5, -BH / 2 + 5, BW - 10, BH - 12); }
          if (b.mat === 'glass') { c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-BW / 2 + 6, BH / 2 - 8); c.lineTo(-BW / 2 + 16, -BH / 2 + 6); c.stroke(); }
          if (b.mat === 'tnt') { c.fillStyle = '#ffffff'; c.font = '900 13px Nunito, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('TNT', 0, 0); }
        }
        c.restore();
      }
      function drawBeam(c: CanvasRenderingContext2D, x: number, y: number, w: number, word: number | undefined, rot: number) {
        c.save(); c.translate(x, y); c.rotate(rot);
        c.fillStyle = word !== undefined ? '#ffffff' : '#a8693a'; roundRect(c, -w / 2, -BEAMH / 2, w, BEAMH, 5);
        if (word !== undefined) {
          c.strokeStyle = '#ffb43d'; c.lineWidth = 2.5; c.beginPath(); c.roundRect(-w / 2, -BEAMH / 2, w, BEAMH, 5); c.stroke();
          c.save(); c.scale(0.9, 0.9); wordLabel(c, word, w - 10); c.restore();
        } else { c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(-w / 2 + 6, -BEAMH / 2 + 3, w - 12, 3); }
        c.restore();
      }
    },
  };
  return g;
}
