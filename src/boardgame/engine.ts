import { boardFor, spaceType, HOME_INDEX, type BoardDef } from './board';

export type Phase = 'lobby' | 'playing' | 'finished';
export interface Player { id: string; name: string; species: string; color: number; pos: number }

export type PendingKind = 'scripture' | 'grace' | 'thankful' | 'share' | 'wander';
export interface Pending { kind: PendingKind; cardIdx: number; rollerId: string; die: number }

export interface Game {
  boardId: string; phase: Phase;
  players: Player[]; order: string[]; turnIdx: number; finishedOrder: string[];
  pending: Pending | null; lastDie: number | null;
}

export const newGame = (boardId = boardFor().id): Game =>
  ({ boardId, phase: 'lobby', players: [], order: [], turnIdx: 0, finishedOrder: [], pending: null, lastDie: null });

export function addPlayer(g: Game, p: { id: string; name: string; species: string; color: number }): Game {
  if (g.players.some((x) => x.id === p.id)) return g;
  return { ...g, players: [...g.players, { ...p, pos: 0 }], order: [...g.order, p.id] };
}

export function start(g: Game): Game {
  if (g.phase !== 'lobby' || g.players.length === 0) return g;
  return { ...g, phase: 'playing', turnIdx: 0 };
}

/** Whose turn it is, skipping anyone already home. Null once everyone's home. */
export function currentId(g: Game): string | null {
  if (g.phase !== 'playing' || g.order.length === 0) return null;
  for (let i = 0; i < g.order.length; i++) {
    const id = g.order[(g.turnIdx + i) % g.order.length];
    if (!g.finishedOrder.includes(id)) return id;
  }
  return null;
}

const board = (g: Game): BoardDef => boardFor(g.boardId);
const clamp = (n: number, max: number) => Math.max(0, Math.min(n, max));

/** Roll for the current player. `die` is 1-6, passed in so it's host-authoritative and testable. */
export function roll(g: Game, id: string, die: number): Game {
  if (g.phase !== 'playing' || g.pending || currentId(g) !== id) return g;
  const b = board(g);
  const home = HOME_INDEX(b);
  const player = g.players.find((p) => p.id === id);
  if (!player) return g;
  const landing = clamp(player.pos + die, home);
  const type = spaceType(b, landing);
  const g0 = { ...g, lastDie: die };

  if (type === 'home' || type === 'plain') {
    return afterMove(g0, id, landing, type === 'home');
  }
  if (type === 'wander') {
    const to = clamp(landing - 2, home);
    return { ...g0, pending: { kind: 'wander', cardIdx: -1, rollerId: id, die }, players: movePlayer(g0, id, to) };
  }
  const cardIdx = type === 'scripture'
    ? Math.floor(Math.random() * b.scriptureCards.length)
    : type === 'grace' ? Math.floor(Math.random() * b.graceCards.length) : -1;
  // Thankful / share / grace already move; scripture's bonus is applied on resolve.
  const to = type === 'thankful' ? clamp(landing + 1, home)
    : type === 'share' ? clamp(landing + 2, home)
    : type === 'grace' ? clamp(landing + 2, home)
    : landing;
  return { ...g0, pending: { kind: type, cardIdx, rollerId: id, die }, players: movePlayer(g0, id, to) };
}

function movePlayer(g: Game, id: string, pos: number): Player[] {
  return g.players.map((p) => (p.id === id ? { ...p, pos } : p));
}

function afterMove(g: Game, id: string, pos: number, home: boolean): Game {
  const players = movePlayer(g, id, pos);
  const finishedOrder = home && !g.finishedOrder.includes(id) ? [...g.finishedOrder, id] : g.finishedOrder;
  const allHome = finishedOrder.length === g.order.length;
  const turnIdx = (g.turnIdx + 1) % Math.max(1, g.order.length);
  return { ...g, players, finishedOrder, turnIdx, phase: allHome ? 'finished' : 'playing' };
}

/** Clears the pending card/prompt and advances the turn. `bonus` only matters for scripture cards. */
export function resolvePending(g: Game, bonus: boolean): Game {
  if (!g.pending) return g;
  const b = board(g);
  const home = HOME_INDEX(b);
  const id = g.pending.rollerId;
  const player = g.players.find((p) => p.id === id);
  if (!player) return { ...g, pending: null };
  let pos = player.pos;
  if (g.pending.kind === 'scripture' && bonus) pos = clamp(pos + 3, home);
  const isHome = pos >= home;
  const g2: Game = { ...g, pending: null };
  return afterMove(g2, id, pos, isHome);
}

export const finishedCount = (g: Game) => g.finishedOrder.length;

const PROMPTS: Record<PendingKind, string> = {
  scripture: 'Scripture Card! Read it to the group.',
  grace: "Fresh Start! Read God's promise out loud.",
  thankful: "Thankful Turkey! Say one thing you're thankful for.",
  share: 'Share the Word! Tell the group one thing you learned this week.',
  wander: 'Wander Off! Move back 2 spaces.',
};

export interface PublicPending { kind: PendingKind; prompt: string; q?: string; a?: string }
export function pendingPublic(g: Game): PublicPending | null {
  if (!g.pending) return null;
  const b = board(g);
  const { kind, cardIdx } = g.pending;
  const base = { kind, prompt: PROMPTS[kind] };
  if (kind === 'scripture') { const c = b.scriptureCards[cardIdx]; return { ...base, q: c.q, a: c.a }; }
  if (kind === 'grace') { const c = b.graceCards[cardIdx]; return { ...base, q: c.text }; }
  return base;
}

export function toPublic(g: Game) {
  const b = board(g);
  return {
    boardId: b.id, title: b.title, totalSpaces: HOME_INDEX(b),
    phase: g.phase,
    players: g.players.map((p) => ({ ...p, done: g.finishedOrder.includes(p.id) })),
    currentId: currentId(g), pending: pendingPublic(g), lastDie: g.lastDie,
  };
}
