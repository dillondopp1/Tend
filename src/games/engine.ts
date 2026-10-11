import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Pet from '../pet/Pet';
import type { SpeciesId } from '../domain/species';

/** Logical playfield; the canvas is scaled to fit the phone. Portrait by default; landscape games switch it. */
export let W = 360;
export let H = 640;
export function setStage(landscape: boolean) { W = landscape ? 800 : 360; H = landscape ? 450 : 640; }

export interface Theme { sky: [string, string]; ground: string; block: string[]; ink: string }

export const PALETTES: Record<string, Theme> = {
  dawn:   { sky: ['#ffd9b8', '#ffeede'], ground: '#f2a97a', block: ['#ff8a5c', '#ffb43d', '#ff7fa3', '#b06cff'], ink: '#5a2e1a' },
  sunset: { sky: ['#ff9a8b', '#ffd1a8'], ground: '#d9675a', block: ['#ff6b6b', '#ffa94d', '#c06cff', '#ff8fab'], ink: '#4a1f2a' },
  ocean:  { sky: ['#8fd3ff', '#d9f2ff'], ground: '#3d8fd1', block: ['#4ab3ff', '#2fbf9f', '#7c5cff', '#ffd23d'], ink: '#123a5a' },
  meadow: { sky: ['#bff0c8', '#eefbe8'], ground: '#6cc070', block: ['#7ccf6a', '#ffd23d', '#ff8a5c', '#4ab3ff'], ink: '#1f4a24' },
  night:  { sky: ['#2b2160', '#5b4a9a'], ground: '#1d1640', block: ['#7c5cff', '#4ab3ff', '#ffd23d', '#ff7fd0'], ink: '#ffffff' },
};

export const MOTIF_EMOJI: Record<string, string> = {
  sun: '☀️', lamp: '🪔', water: '💧', tree: '🌳', heart: '💖', dove: '🕊️', olive: '🫒', scroll: '📜', star: '⭐',
  crown: '👑', fish: '🐟', wave: '🌊', lion: '🦁', harp: '🎵', wheat: '🌾', vine: '🍇', trumpet: '🎺', mountain: '⛰️',
  stone: '🪨', brick: '🧱',
};

export function themeFor(palette?: string): Theme { return PALETTES[palette ?? ''] ?? PALETTES.dawn; }

export function motifs(list?: string[]): string[] {
  const m = (list ?? []).map((k) => MOTIF_EMOJI[k]).filter(Boolean);
  return m.length ? m : ['⭐', '💖', '☀️'];
}

const petCache = new Map<string, HTMLImageElement>();
export function petImage(species: SpeciesId, variant: number): HTMLImageElement {
  const key = `${species}:${variant}`;
  let img = petCache.get(key);
  if (!img) {
    const svg = renderToStaticMarkup(createElement(Pet, { species, variant, mood: 'thriving', animate: false, size: 200 }))
      .replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    petCache.set(key, img);
  }
  return img;
}

export function sky(ctx: CanvasRenderingContext2D, t: Theme) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, t.sky[0]); g.addColorStop(1, t.sky[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); ctx.fill();
}

export function word(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  ctx.font = '800 16px Nunito, system-ui, sans-serif';
  const w = ctx.measureText(text).width + 22;
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#ffd23d'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(x - w / 2, y - 16, w, 32, 16); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#5b3fe0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + 1);
  return w;
}

export function hud(ctx: CanvasRenderingContext2D, score: number, t: Theme, extra?: string) {
  ctx.fillStyle = t.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.font = '900 44px Nunito, system-ui, sans-serif';
  ctx.globalAlpha = 0.9; ctx.fillText(String(score), W / 2, 22); ctx.globalAlpha = 1;
  if (extra) { ctx.font = '800 14px Nunito, system-ui, sans-serif'; ctx.fillText(extra, W / 2, 72); }
}

/** The words of the key phrase still to collect, shown at the bottom of the screen. */
export function phraseBar(ctx: CanvasRenderingContext2D, words: string[], got: boolean[], t: Theme) {
  ctx.font = '800 14px Nunito, system-ui, sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const parts = words.map((w) => w);
  const total = parts.reduce((s, w) => s + ctx.measureText(w).width + 8, -8);
  let x = (W - total) / 2;
  parts.forEach((w, i) => {
    ctx.fillStyle = got[i] ? '#5b3fe0' : t.ink; ctx.globalAlpha = got[i] ? 1 : 0.35;
    ctx.fillText(w, x, H - 18); x += ctx.measureText(w).width + 8;
  });
  ctx.globalAlpha = 1;
}

export interface Game {
  step(dt: number): void;
  draw(ctx: CanvasRenderingContext2D): void;
  press(x: number, y: number): void;
  move?(x: number, y: number): void;
  release?(): void;
  over: boolean;
  started: boolean;
  score: number;
  phraseDone: boolean;
}

export interface GameOpts { species: SpeciesId; variant: number; palette?: string; motifs?: string[]; phrase: string; phraseRef?: string }

export function phraseWords(phrase: string): string[] {
  return phrase.split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}'’-]/gu, '')).filter(Boolean);
}

export const rand = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * The week's key phrase as the heart of a game: words spawn in order, collected words light up in the
 * always-visible phrase banner, and finishing it shows the whole phrase + reference big, then starts
 * another round so the phrase keeps coming back.
 */
export class Phrase {
  readonly words: string[];
  got: boolean[];
  rounds = 0;
  private cursor = 0;
  private celebrate = 0;
  constructor(phrase: string, readonly ref = '') {
    this.words = phraseWords(phrase);
    if (!this.words.length) this.words = ['Spark'];
    this.got = this.words.map(() => false);
  }
  /** Index of the next word to put in the world (skips ones already collected this round). */
  next(): number {
    for (let k = 0; k < this.words.length; k++) {
      const i = (this.cursor + k) % this.words.length;
      if (!this.got[i]) { this.cursor = (i + 1) % this.words.length; return i; }
    }
    return 0;
  }
  /** Returns true when this word completed the phrase. */
  collect(i: number): boolean {
    this.got[i] = true;
    if (this.got.every(Boolean)) {
      this.rounds++; this.celebrate = 2.2; this.got = this.words.map(() => false); this.cursor = 0;
      return true;
    }
    return false;
  }
  step(dt: number) { this.celebrate = Math.max(0, this.celebrate - dt); }
  get celebrating() { return this.celebrate > 0; }

  /** Banner with the whole phrase near the top; collected words glow. */
  drawBanner(ctx: CanvasRenderingContext2D, y = 92) {
    ctx.save();
    ctx.font = '900 19px Nunito, system-ui, sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const gap = 8;
    const widths = this.words.map((w) => ctx.measureText(w).width);
    const total = widths.reduce((a, b) => a + b + gap, -gap);
    const scale = Math.min(1, (W - 40) / total);
    ctx.translate(W / 2, y); ctx.scale(scale, scale);
    ctx.fillStyle = 'rgba(43,33,64,.55)';
    ctx.beginPath(); ctx.roundRect(-total / 2 - 14, -17, total + 28, 34, 17); ctx.fill();
    let x = -total / 2;
    this.words.forEach((w, i) => {
      ctx.fillStyle = this.got[i] ? '#ffd23d' : 'rgba(255,255,255,.55)';
      if (this.got[i]) { ctx.shadowColor = '#ffd23d'; ctx.shadowBlur = 12; } else ctx.shadowBlur = 0;
      ctx.fillText(w, x, 1); x += widths[i] + gap;
    });
    ctx.restore();
    if (this.ref) {
      ctx.font = '800 12px Nunito, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(43,33,64,.7)';
      ctx.fillText(this.ref + (this.rounds ? `  ·  ✨ x${this.rounds}` : ''), W / 2, y + 26);
    }
  }

  /** Full-screen moment when the phrase is completed. */
  drawCelebration(ctx: CanvasRenderingContext2D) {
    if (!this.celebrating) return;
    const a = Math.min(1, this.celebrate / 0.4);
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(43,33,64,.72)'; ctx.fillRect(0, H / 2 - 110, W, 220);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffd23d';
    ctx.font = '900 16px Nunito, system-ui, sans-serif'; ctx.fillText('✨ PHRASE COMPLETE ✨', W / 2, H / 2 - 74);
    ctx.fillStyle = '#ffffff';
    const text = `“${this.words.join(' ')}”`;
    let size = 34; ctx.font = `900 ${size}px Nunito, system-ui, sans-serif`;
    while (ctx.measureText(text).width > W - 30 && size > 18) { size -= 2; ctx.font = `900 ${size}px Nunito, system-ui, sans-serif`; }
    ctx.fillText(text, W / 2, H / 2 - 10);
    if (this.ref) { ctx.font = '800 17px Nunito, system-ui, sans-serif'; ctx.fillStyle = '#ffd23d'; ctx.fillText(this.ref, W / 2, H / 2 + 36); }
    ctx.font = '800 14px Nunito, system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.fillText('Bonus! Collect it again for more', W / 2, H / 2 + 72);
    ctx.restore();
  }
}

/** A big, readable word token used by the newer games. */
export function bigWord(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.font = '900 20px Nunito, system-ui, sans-serif';
  const w = ctx.measureText(text).width + 26;
  ctx.shadowColor = '#ffd23d'; ctx.shadowBlur = 16;
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#ffb43d'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.roundRect(-w / 2, -19, w, 38, 19); ctx.fill(); ctx.shadowBlur = 0; ctx.stroke();
  ctx.fillStyle = '#5b3fe0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 0, 1);
  ctx.restore();
  return w * scale;
}
