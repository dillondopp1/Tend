import {
  boardFor, type BoardDef, type Resource, RESOURCES,
  MAX_SETTLERS_PER_TILE, MAX_BUILDINGS_PER_PLAYER, WIN_POINTS, ALTAR_COST, TEMPLE_COST,
} from './board';

export type Phase = 'lobby' | 'settle' | 'playing' | 'finished';
export type Hand = Record<Resource, number>;
const emptyHand = (): Hand => ({ faith: 0, mercy: 0, thanks: 0, word: 0 });

export interface Player { id: string; name: string; species: string; color: number; resources: Hand; points: number }
export interface Building { tileId: number; playerId: string; level: 1 | 2 }
export type CardKind = 'scripture' | 'grace';
export interface CardEvent { kind: CardKind; cardIdx: number }
export interface TradeOffer { id: string; from: string; to: string | null; give: Partial<Hand>; want: Partial<Hand> }

export interface Game {
  boardId: string; phase: Phase;
  players: Player[]; order: string[]; turnIdx: number;
  buildings: Building[]; trades: TradeOffer[];
  lastRoll: [number, number] | null; card: CardEvent | null;
  winnerId: string | null;
}

export const newGame = (boardId = boardFor().id): Game =>
  ({ boardId, phase: 'lobby', players: [], order: [], turnIdx: 0, buildings: [], trades: [], lastRoll: null, card: null, winnerId: null });

export function addPlayer(g: Game, p: { id: string; name: string; species: string; color: number }): Game {
  if (g.players.some((x) => x.id === p.id)) return g;
  return { ...g, players: [...g.players, { ...p, resources: emptyHand(), points: 0 }], order: [...g.order, p.id] };
}

export function start(g: Game): Game {
  if (g.phase !== 'lobby' || g.players.length === 0) return g;
  return { ...g, phase: 'settle', turnIdx: 0 };
}

const board = (g: Game): BoardDef => boardFor(g.boardId);
const tileSettlers = (g: Game, tileId: number) => g.buildings.filter((b) => b.tileId === tileId).length;
const playerBuildings = (g: Game, playerId: string) => g.buildings.filter((b) => b.playerId === playerId);

export function currentId(g: Game): string | null {
  if ((g.phase !== 'playing' && g.phase !== 'settle') || g.order.length === 0) return null;
  return g.order[g.turnIdx % g.order.length];
}

/** Settle phase: each player picks one tile for their first Altar, in turn order. */
export function settle(g: Game, playerId: string, tileId: number): Game {
  if (g.phase !== 'settle' || currentId(g) !== playerId) return g;
  if (playerBuildings(g, playerId).length > 0) return g;
  const b = board(g);
  if (!b.tiles.some((t) => t.id === tileId)) return g;
  if (tileSettlers(g, tileId) >= MAX_SETTLERS_PER_TILE) return g;
  const players = g.players.map((p) => (p.id === playerId ? { ...p, points: p.points + 1 } : p));
  const buildings = [...g.buildings, { tileId, playerId, level: 1 as const }];
  const turnIdx = g.turnIdx + 1;
  const done = players.every((p) => playerBuildings({ ...g, buildings }, p.id).length > 0);
  return { ...g, players, buildings, turnIdx: done ? 0 : turnIdx, phase: done ? 'playing' : 'settle' };
}

function hasEnough(hand: Hand, cost: Partial<Hand>): boolean {
  return (Object.keys(cost) as Resource[]).every((r) => hand[r] >= (cost[r] ?? 0));
}
function pay(hand: Hand, cost: Partial<Hand>): Hand {
  const h = { ...hand };
  for (const r of Object.keys(cost) as Resource[]) h[r] -= cost[r] ?? 0;
  return h;
}
function give(hand: Hand, amt: Partial<Hand>): Hand {
  const h = { ...hand };
  for (const r of Object.keys(amt) as Resource[]) h[r] += amt[r] ?? 0;
  return h;
}

function checkWin(g: Game): Game {
  const winner = g.players.find((p) => p.points >= WIN_POINTS);
  return winner ? { ...g, phase: 'finished', winnerId: winner.id } : g;
}

/** Roll two dice. A 7 draws a scripture/grace card for the whole class instead of producing resources. */
export function roll(g: Game, id: string, die1: number, die2: number): Game {
  if (g.phase !== 'playing' || g.card || currentId(g) !== id) return g;
  const sum = die1 + die2;
  if (sum === 7) {
    const kind: CardKind = Math.random() < 0.5 ? 'scripture' : 'grace';
    const b = board(g);
    const n = kind === 'scripture' ? b.scriptureCards.length : b.graceCards.length;
    return { ...g, lastRoll: [die1, die2], card: { kind, cardIdx: Math.floor(Math.random() * n) } };
  }
  const b = board(g);
  const matching = b.tiles.filter((t) => t.number === sum);
  let players = g.players;
  for (const t of matching) {
    for (const bld of g.buildings.filter((x) => x.tileId === t.id)) {
      players = players.map((p) => (p.id === bld.playerId ? { ...p, resources: give(p.resources, { [t.resource]: bld.level }) } : p));
    }
  }
  return { ...g, players, lastRoll: [die1, die2], turnIdx: g.turnIdx + 1 };
}

/** Clears the whole-class card event after a 7 and advances the turn. */
export function continueCard(g: Game): Game {
  if (!g.card) return g;
  return { ...g, card: null, turnIdx: g.turnIdx + 1 };
}

export function build(g: Game, playerId: string, tileId: number): Game {
  if (g.phase !== 'playing') return g;
  const player = g.players.find((p) => p.id === playerId);
  if (!player) return g;
  if (playerBuildings(g, playerId).length >= MAX_BUILDINGS_PER_PLAYER) return g;
  if (tileSettlers(g, tileId) >= MAX_SETTLERS_PER_TILE) return g;
  if (!hasEnough(player.resources, ALTAR_COST)) return g;
  const players = g.players.map((p) => (p.id === playerId ? { ...p, resources: pay(p.resources, ALTAR_COST), points: p.points + 1 } : p));
  const buildings = [...g.buildings, { tileId, playerId, level: 1 as const }];
  return checkWin({ ...g, players, buildings });
}

export function upgrade(g: Game, playerId: string, tileId: number): Game {
  if (g.phase !== 'playing') return g;
  const player = g.players.find((p) => p.id === playerId);
  const bld = g.buildings.find((b) => b.tileId === tileId && b.playerId === playerId && b.level === 1);
  if (!player || !bld) return g;
  if (!hasEnough(player.resources, TEMPLE_COST)) return g;
  const players = g.players.map((p) => (p.id === playerId ? { ...p, resources: pay(p.resources, TEMPLE_COST), points: p.points + 1 } : p));
  const buildings = g.buildings.map((b) => (b === bld ? { ...b, level: 2 as const } : b));
  return checkWin({ ...g, players, buildings });
}

export function proposeTrade(g: Game, from: string, give_: Partial<Hand>, want: Partial<Hand>, to: string | null, newId: () => string): Game {
  if (g.phase !== 'playing') return g;
  const player = g.players.find((p) => p.id === from);
  if (!player || !hasEnough(player.resources, give_)) return g;
  return { ...g, trades: [...g.trades, { id: newId(), from, to, give: give_, want }] };
}

export function cancelTrade(g: Game, offerId: string, playerId: string): Game {
  const offer = g.trades.find((t) => t.id === offerId);
  if (!offer || offer.from !== playerId) return g;
  return { ...g, trades: g.trades.filter((t) => t.id !== offerId) };
}

export function acceptTrade(g: Game, offerId: string, accepterId: string): Game {
  const offer = g.trades.find((t) => t.id === offerId);
  if (!offer || offer.from === accepterId || (offer.to && offer.to !== accepterId)) return g;
  const seller = g.players.find((p) => p.id === offer.from);
  const buyer = g.players.find((p) => p.id === accepterId);
  if (!seller || !buyer || !hasEnough(seller.resources, offer.give) || !hasEnough(buyer.resources, offer.want)) return g;
  const players = g.players.map((p) => {
    if (p.id === offer.from) return { ...p, resources: give(pay(p.resources, offer.give), offer.want) };
    if (p.id === accepterId) return { ...p, resources: give(pay(p.resources, offer.want), offer.give) };
    return p;
  });
  return { ...g, players, trades: g.trades.filter((t) => t.id !== offerId) };
}

const PROMPT: Record<CardKind, string> = { scripture: 'Scripture Card! Read it to the group.', grace: "Fresh Start! Read God's promise out loud." };
export interface PublicCard { kind: CardKind; prompt: string; q?: string; a?: string }
export function cardPublic(g: Game): PublicCard | null {
  if (!g.card) return null;
  const b = board(g);
  const { kind, cardIdx } = g.card;
  if (kind === 'scripture') { const c = b.scriptureCards[cardIdx]; return { kind, prompt: PROMPT.scripture, q: c.q, a: c.a }; }
  const c = b.graceCards[cardIdx]; return { kind, prompt: PROMPT.grace, q: c.text };
}

export function toPublic(g: Game) {
  const b = board(g);
  return {
    boardId: b.id, title: b.title, phase: g.phase,
    tiles: b.tiles.map((t) => ({ ...t, settlers: g.buildings.filter((x) => x.tileId === t.id).map((x) => ({ playerId: x.playerId, level: x.level })) })),
    players: g.players, currentId: currentId(g), lastRoll: g.lastRoll, card: cardPublic(g),
    trades: g.trades, winnerId: g.winnerId,
  };
}

export const RESOURCE_LIST = RESOURCES;
export type PublicState = ReturnType<typeof toPublic>;
