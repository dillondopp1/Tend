import { W, H, type Game, type GameOpts, themeFor, petImage, sky, roundRect, hud, Phrase, motifs } from './engine';

// Match-3, 60 seconds. Swipe a tile (or tap two neighbours) to swap; 3+ in a row clear and cascade.
// Key-phrase words ride on some tiles: clear one to collect its word.
const COLS = 7, ROWS = 8, CELL = 48, OX = (W - COLS * CELL) / 2, OY = 146, TIME = 60;
const EXTRA = ['⭐', '💖', '☀️', '🍎', '🌸', '💧', '🌳', '🕊️'];

type Tile = { k: number; word?: number; fall: number; pop: number };

export function createGather(o: GameOpts): Game {
  const t = themeFor(o.palette);
  const pet = petImage(o.species, o.variant);
  const phrase = new Phrase(o.phrase, o.phraseRef, o.phraseMeaning);
  const words = phrase.words;
  const kinds = [...new Set([...motifs(o.motifs), ...EXTRA])].slice(0, 6);
  let grid: (Tile | null)[][] = [];
  let left = TIME, sel: [number, number] | null = null, down: { x: number; y: number; c: [number, number] } | null = null;
  let busy = 0, combo = 0, toast = '', toastT = 0, wordsOnBoard = 0, flash = 0;
  const swapAnim: { a: [number, number]; b: [number, number]; t: number; back: boolean } = { a: [0, 0], b: [0, 0], t: 0, back: false };

  const rnd = () => Math.floor(Math.random() * kinds.length);
  const fresh = (fall = 0): Tile => {
    const tile: Tile = { k: rnd(), fall, pop: 0 };
    if (wordsOnBoard < 2 && Math.random() < 0.2) { tile.word = phrase.next(); wordsOnBoard++; }
    return tile;
  };
  // Start without ready-made matches.
  for (let r = 0; r < ROWS; r++) {
    grid.push([]);
    for (let c = 0; c < COLS; c++) {
      let tile: Tile;
      do { tile = { k: rnd(), fall: 0, pop: 0 }; } while (
        (c >= 2 && grid[r][c - 1]!.k === tile.k && grid[r][c - 2]!.k === tile.k) ||
        (r >= 2 && grid[r - 1][c]!.k === tile.k && grid[r - 2][c]!.k === tile.k));
      grid[r].push(tile);
    }
  }

  function matches(): boolean[][] {
    const m = grid.map((row) => row.map(() => false));
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const k = grid[r][c]?.k;
      if (k === undefined) continue;
      if (c + 2 < COLS && grid[r][c + 1]?.k === k && grid[r][c + 2]?.k === k) { let e = c; while (e < COLS && grid[r][e]?.k === k) m[r][e++] = true; }
      if (r + 2 < ROWS && grid[r + 1][c]?.k === k && grid[r + 2][c]?.k === k) { let e = r; while (e < ROWS && grid[e][c]?.k === k) m[e++][c] = true; }
    }
    return m;
  }

  function clearAndDrop(): number {
    const m = matches();
    let n = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (m[r][c]) {
      const tile = grid[r][c]!;
      if (tile.word !== undefined) {
        wordsOnBoard--; g.score += 50; flash = 0.6; toast = `“${words[tile.word]}”`; toastT = 1.2;
        if (phrase.collect(tile.word)) { g.phraseDone = true; g.score += 200; }
      }
      grid[r][c] = null; n++;
    }
    if (!n) return 0;
    combo++;
    g.score += n * 10 * combo;
    if (combo > 1) { toast = `Combo x${combo}!`; toastT = 0.9; }
    for (let c = 0; c < COLS; c++) {
      let write = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) if (grid[r][c]) {
        const tile = grid[r][c]!;
        if (write !== r) { tile.fall = (write - r) * CELL; grid[write][c] = tile; grid[r][c] = null; }
        write--;
      }
      for (let r = write, k = 1; r >= 0; r--, k++) grid[r][c] = fresh((write + 1) * CELL + k * 6);
    }
    return n;
  }

  const cellAt = (x: number, y: number): [number, number] | null => {
    const c = Math.floor((x - OX) / CELL), r = Math.floor((y - OY) / CELL);
    return r >= 0 && r < ROWS && c >= 0 && c < COLS ? [r, c] : null;
  };
  const adjacent = (a: [number, number], b: [number, number]) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
  const swap = (a: [number, number], b: [number, number]) => {
    const x = grid[a[0]][a[1]]; grid[a[0]][a[1]] = grid[b[0]][b[1]]; grid[b[0]][b[1]] = x;
  };
  function trySwap(a: [number, number], b: [number, number]) {
    if (busy > 0 || !adjacent(a, b)) return;
    swap(a, b);
    const ok = matches().some((row) => row.some(Boolean));
    if (!ok) swap(a, b);
    Object.assign(swapAnim, { a, b, t: 0.18, back: !ok });
    if (ok) { combo = 0; busy = 0.18; }
    sel = null;
  }

  const g: Game = {
    over: false, started: false, score: 0, phraseDone: false,
    press(x, y) {
      if (g.over) return;
      g.started = true;
      const c = cellAt(x, y);
      if (!c) { sel = null; return; }
      down = { x, y, c };
    },
    move(x, y) {
      if (!down) return;
      const dx = x - down.x, dy = y - down.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > 18) {
        const to: [number, number] = Math.abs(dx) > Math.abs(dy) ? [down.c[0], down.c[1] + Math.sign(dx)] : [down.c[0] + Math.sign(dy), down.c[1]];
        if (to[0] >= 0 && to[0] < ROWS && to[1] >= 0 && to[1] < COLS) trySwap(down.c, to);
        down = null;
      }
    },
    release() {
      if (!down) return;
      const c = down.c; down = null;
      if (sel && adjacent(sel, c)) trySwap(sel, c);
      else sel = sel && sel[0] === c[0] && sel[1] === c[1] ? null : c;
    },
    step(dt) {
      phrase.step(dt);
      toastT = Math.max(0, toastT - dt); flash = Math.max(0, flash - dt);
      swapAnim.t = Math.max(0, swapAnim.t - dt);
      let falling = false;
      for (const row of grid) for (const tile of row) if (tile && tile.fall > 0) { tile.fall = Math.max(0, tile.fall - 900 * dt); falling = true; }
      if (busy > 0) { busy -= dt; if (busy <= 0 && !falling) { if (clearAndDrop()) busy = 0.25; } }
      else if (!falling && matches().some((r) => r.some(Boolean))) busy = 0.12; // cascades
      if (g.started && !g.over) { left -= dt; if (left <= 0 && busy <= 0 && !falling) { left = 0; g.over = true; } }
    },
    draw(ctx) {
      sky(ctx, t);
      ctx.fillStyle = 'rgba(255,255,255,.55)'; roundRect(ctx, OX - 8, OY - 8, COLS * CELL + 16, ROWS * CELL + 16, 18);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const sw = swapAnim.t > 0 ? swapAnim.t / 0.18 : 0;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const tile = grid[r][c]; if (!tile) continue;
        let x = OX + c * CELL + CELL / 2, y = OY + r * CELL + CELL / 2 - tile.fall;
        if (sw > 0) {
          const { a, b, back } = swapAnim;
          const amt = back ? Math.sin(sw * Math.PI) : sw;
          if (r === a[0] && c === a[1]) { x += (b[1] - a[1]) * CELL * amt; y += (b[0] - a[0]) * CELL * amt; }
          if (r === b[0] && c === b[1]) { x += (a[1] - b[1]) * CELL * amt; y += (a[0] - b[0]) * CELL * amt; }
        }
        if (y < OY - CELL / 2) continue;
        const isSel = sel && sel[0] === r && sel[1] === c;
        ctx.fillStyle = isSel ? '#ffe9a8' : tile.word !== undefined ? '#efe6ff' : '#ffffff';
        roundRect(ctx, x - CELL / 2 + 3, y - CELL / 2 + 3, CELL - 6, CELL - 6, 12);
        if (tile.word !== undefined) {
          ctx.strokeStyle = '#7c5cff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x - CELL / 2 + 3, y - CELL / 2 + 3, CELL - 6, CELL - 6, 12); ctx.stroke();
          ctx.fillStyle = '#5b3fe0';
          let fs = 11; ctx.font = `900 ${fs}px Nunito, system-ui, sans-serif`;
          while (ctx.measureText(words[tile.word]).width > CELL - 8 && fs > 7) { fs--; ctx.font = `900 ${fs}px Nunito, system-ui, sans-serif`; }
          ctx.fillText(words[tile.word], x, y + 13);
          ctx.font = '22px serif'; ctx.fillText(kinds[tile.k], x, y - 5);
        } else { ctx.font = '28px serif'; ctx.fillText(kinds[tile.k], x, y + 1); }
      }
      // Timer bar
      const ty = OY + ROWS * CELL + 14;
      ctx.fillStyle = 'rgba(0,0,0,.12)'; roundRect(ctx, OX, ty, COLS * CELL, 10, 5);
      ctx.fillStyle = left < 10 ? '#ff6b6b' : '#7c5cff'; roundRect(ctx, OX, ty, COLS * CELL * (left / TIME), 10, 5);
      const by = ty + 16;
      ctx.drawImage(pet, W / 2 - 30, by + (flash > 0 ? -8 : 0), 60, 60);
      if (toastT > 0) { ctx.fillStyle = '#5b3fe0'; ctx.font = '900 20px Nunito, system-ui, sans-serif'; ctx.fillText(toast, W / 2, by + 74); }
      hud(ctx, g.score, t, g.started ? `${Math.ceil(left)}s` : 'Swipe a tile to swap. Match 3!');
      phrase.drawBanner(ctx, 100);
      phrase.drawCelebration(ctx);
    },
  };
  return g;
}
