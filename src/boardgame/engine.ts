import { deckFor, HAND_SIZE, WIN_GREENS, type DeckDef } from './board';

export type Phase = 'lobby' | 'playing' | 'judging' | 'reveal' | 'finished';
export type Rand = () => number;

export interface Player { id: string; name: string; species: string; color: number; hand: number[]; greens: number[] }
export interface Play { by: string; card: number }

export interface Game {
  deckId: string; phase: Phase;
  players: Player[]; judgeIdx: number;
  green: number | null; plays: Play[]; winner: Play | null;
  redDeck: number[]; greenDeck: number[];
  winnerId: string | null;
}

const deck = (g: Game): DeckDef => deckFor(g.deckId);

export function shuffle<T>(arr: T[], rand: Rand): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export const newGame = (deckId = deckFor().id): Game => ({
  deckId, phase: 'lobby', players: [], judgeIdx: 0, green: null, plays: [], winner: null, redDeck: [], greenDeck: [], winnerId: null,
});

/** Tops each hand back up to HAND_SIZE from the red deck. */
function deal(players: Player[], redDeck: number[]): { players: Player[]; redDeck: number[] } {
  let rest = redDeck;
  const out = players.map((p) => {
    const need = Math.max(0, HAND_SIZE - p.hand.length);
    const hand = [...p.hand, ...rest.slice(0, need)];
    rest = rest.slice(need);
    return { ...p, hand };
  });
  return { players: out, redDeck: rest };
}

function flipGreen(g: Game, rand: Rand): Game {
  let greenDeck = g.greenDeck;
  if (greenDeck.length === 0) {
    const held = new Set(g.players.flatMap((p) => p.greens));
    greenDeck = shuffle(deck(g).greens.map((_, i) => i).filter((i) => !held.has(i)), rand);
  }
  return { ...g, green: greenDeck[0] ?? null, greenDeck: greenDeck.slice(1) };
}

export function addPlayer(g: Game, p: { id: string; name: string; species: string; color: number }): Game {
  if (g.players.some((x) => x.id === p.id)) return g;
  const joined = { ...p, hand: [] as number[], greens: [] as number[] };
  if (g.phase === 'lobby') return { ...g, players: [...g.players, joined] };
  // A late joiner gets a hand right away and can play this round.
  const dealt = deal([joined], g.redDeck);
  return { ...g, players: [...g.players, dealt.players[0]], redDeck: dealt.redDeck };
}

export const MIN_PLAYERS = 3;

export function start(g: Game, rand: Rand = Math.random): Game {
  if (g.phase !== 'lobby' && g.phase !== 'finished') return g;
  if (g.players.length < MIN_PLAYERS) return g;
  const d = deck(g);
  const fresh = g.players.map((p) => ({ ...p, hand: [], greens: [] }));
  const dealt = deal(fresh, shuffle(d.reds.map((_, i) => i), rand));
  const base: Game = {
    ...g, phase: 'playing', players: dealt.players, redDeck: dealt.redDeck, judgeIdx: 0,
    greenDeck: shuffle(d.greens.map((_, i) => i), rand), plays: [], winner: null, winnerId: null,
  };
  return flipGreen(base, rand);
}

export const judgeId = (g: Game): string | null => g.players[g.judgeIdx % Math.max(1, g.players.length)]?.id ?? null;
const pickers = (g: Game) => g.players.filter((p) => p.id !== judgeId(g));
export const allIn = (g: Game) => pickers(g).every((p) => g.plays.some((x) => x.by === p.id));

/** Shuffles what's been played and hands it to the judge. */
export function closePlays(g: Game, rand: Rand = Math.random): Game {
  if (g.phase !== 'playing' || g.plays.length === 0) return g;
  return { ...g, phase: 'judging', plays: shuffle(g.plays, rand) };
}

export function play(g: Game, id: string, card: number, rand: Rand = Math.random): Game {
  if (g.phase !== 'playing' || id === judgeId(g) || g.plays.some((x) => x.by === id)) return g;
  const p = g.players.find((x) => x.id === id);
  if (!p || !p.hand.includes(card)) return g;
  const next: Game = {
    ...g,
    players: g.players.map((x) => (x.id === id ? { ...x, hand: x.hand.filter((c) => c !== card) } : x)),
    plays: [...g.plays, { by: id, card }],
  };
  return allIn(next) ? closePlays(next, rand) : next;
}

/** The judge picks a winning red card. The host passes the judge's id when picking for them. */
export function pick(g: Game, by: string, card: number): Game {
  if (g.phase !== 'judging' || by !== judgeId(g) || g.green === null) return g;
  const win = g.plays.find((x) => x.card === card);
  if (!win) return g;
  const green = g.green;
  const ps = g.players.map((p) => (p.id === win.by ? { ...p, greens: [...p.greens, green] } : p));
  const champ = ps.find((p) => p.greens.length >= WIN_GREENS);
  return { ...g, players: ps, winner: win, phase: champ ? 'finished' : 'reveal', winnerId: champ?.id ?? null };
}

/** Next round: played reds go to the bottom of the deck, hands refill, the judge rotates, a new green flips. */
export function next(g: Game, rand: Rand = Math.random): Game {
  if (g.phase !== 'reveal') return g;
  const dealt = deal(g.players, [...g.redDeck, ...g.plays.map((x) => x.card)]);
  return flipGreen({
    ...g, phase: 'playing', players: dealt.players, redDeck: dealt.redDeck,
    judgeIdx: (g.judgeIdx + 1) % g.players.length, plays: [], winner: null,
  }, rand);
}

/** Drops a player (left class, phone died). If they were judging, the next player takes over. */
export function removePlayer(g: Game, id: string): Game {
  const i = g.players.findIndex((p) => p.id === id);
  if (i < 0) return g;
  const wasJudge = judgeId(g) === id;
  const left = g.players[i];
  const ps = g.players.filter((p) => p.id !== id);
  const judgeIdx = ps.length === 0 ? 0 : (i < g.judgeIdx ? g.judgeIdx - 1 : g.judgeIdx) % ps.length;
  // Their cards go back in the deck so nothing is lost.
  const back = [...left.hand, ...g.plays.filter((x) => x.by === id).map((x) => x.card)];
  const out: Game = { ...g, players: ps, judgeIdx, plays: g.plays.filter((x) => x.by !== id), redDeck: [...g.redDeck, ...back] };
  return wasJudge && out.phase === 'judging' ? { ...out, phase: 'playing' } : out;
}

export function toPublic(g: Game) {
  const d = deck(g);
  const showBy = g.phase === 'reveal' || g.phase === 'finished';
  const red = (card: number) => ({ card, text: d.reds[card] });
  return {
    deckId: d.id, title: d.title, phase: g.phase, judgeId: judgeId(g), winTarget: WIN_GREENS,
    green: g.green === null ? null : d.greens[g.green],
    players: g.players.map((p) => ({
      id: p.id, name: p.name, species: p.species, color: p.color,
      greens: p.greens.map((i) => d.greens[i].word),
      played: g.plays.some((x) => x.by === p.id),
      hand: p.hand.map(red),
    })),
    // Anonymous while the judge decides; names show on the reveal.
    plays: g.phase === 'playing' ? [] : g.plays.map((x) => ({ ...red(x.card), by: showBy ? x.by : null })),
    winner: g.winner ? { ...red(g.winner.card), by: g.winner.by } : null,
    winnerId: g.winnerId,
  };
}
export type PublicState = ReturnType<typeof toPublic>;
