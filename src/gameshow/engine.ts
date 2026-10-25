import { ROUNDS, MAX_ANSWER } from './rounds';

export type Phase = 'lobby' | 'intro' | 'writing' | 'voting' | 'reveal' | 'finale';

export interface Player { id: string; name: string; species: string; color: number }
export interface Answer { aid: string; by: string; text: string }

/** Everything the host knows. Phones only ever see PublicState. */
export interface Show {
  phase: Phase; round: number; // index into ROUNDS
  players: Player[];
  answers: Answer[]; votes: Record<string, string>; // voter id -> aid
  endsAt: number | null; // ms epoch for the current timer
}

export interface PublicAnswer { aid: string; text: string; owner: string; by?: string; votes?: number }
export interface PublicState {
  phase: Phase; round: number; endsAt: number | null;
  players: (Player & { done: boolean })[];
  answers: PublicAnswer[]; // voting: anonymous order; reveal: with `by` + `votes`
  doneCount: number;
}

export const newShow = (): Show => ({ phase: 'lobby', round: 0, players: [], answers: [], votes: {}, endsAt: null });

export function addPlayer(s: Show, p: Player): Show {
  const i = s.players.findIndex((x) => x.id === p.id);
  const players = i >= 0 ? s.players.map((x, j) => (j === i ? p : x)) : [...s.players, p];
  return { ...s, players };
}

export const cleanAnswer = (t: string) => t.replace(/\s+/g, ' ').trim().slice(0, MAX_ANSWER);

export function submitAnswer(s: Show, id: string, text: string, newId: () => string): Show {
  const t = cleanAnswer(text);
  if (s.phase !== 'writing' || !t || !s.players.some((p) => p.id === id)) return s;
  const rest = s.answers.filter((a) => a.by !== id);
  return { ...s, answers: [...rest, { aid: newId(), by: id, text: t }] };
}

export function castVote(s: Show, id: string, aid: string): Show {
  const a = s.answers.find((x) => x.aid === aid);
  if (s.phase !== 'voting' || !a || a.by === id || !s.players.some((p) => p.id === id)) return s;
  return { ...s, votes: { ...s.votes, [id]: aid } };
}

export function removeAnswer(s: Show, aid: string): Show {
  const votes = Object.fromEntries(Object.entries(s.votes).filter(([, v]) => v !== aid));
  return { ...s, answers: s.answers.filter((a) => a.aid !== aid), votes };
}

/** Who has finished the current step. */
export function doneIds(s: Show): string[] {
  if (s.phase === 'writing') return s.answers.map((a) => a.by);
  if (s.phase === 'voting') return Object.keys(s.votes);
  return [];
}

/** Voters who can actually vote on something (an author can't vote on their own, so need >= 2 answers). */
export const everyoneDone = (s: Show) => s.players.length > 0 && s.players.every((p) => doneIds(s).includes(p.id));

export function toPublic(s: Show): PublicState {
  const done = doneIds(s);
  const tally = (aid: string) => Object.values(s.votes).filter((v) => v === aid).length;
  const name = (id: string) => s.players.find((p) => p.id === id)?.name ?? '?';
  let answers: PublicAnswer[] = [];
  if (s.phase === 'voting') {
    answers = s.answers.map((a) => ({ aid: a.aid, text: a.text, owner: a.by })).sort((a, b) => (a.aid < b.aid ? -1 : 1));
  } else if (s.phase === 'reveal') {
    answers = s.answers.map((a) => ({ aid: a.aid, text: a.text, owner: a.by, by: name(a.by), votes: tally(a.aid) }))
      .sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));
  }
  return {
    phase: s.phase, round: s.round, endsAt: s.endsAt,
    players: s.players.map((p) => ({ ...p, done: done.includes(p.id) })),
    answers, doneCount: done.length,
  };
}

export type Step = 'start' | 'closeWriting' | 'closeVoting' | 'next' | 'finish';

/** Move the show forward. `now` is passed in so timers stay testable. */
export function advance(s: Show, step: Step, now: number, secs: { write: number; vote: number }): Show {
  const last = s.round >= ROUNDS.length - 1;
  switch (step) {
    case 'start': // lobby -> intro (round 1), or reveal -> next intro
      return { ...s, phase: 'intro', round: s.phase === 'lobby' ? 0 : s.round, answers: [], votes: {}, endsAt: null };
    case 'closeWriting': {
      if (s.phase === 'intro') return { ...s, phase: 'writing', answers: [], votes: {}, endsAt: now + secs.write * 1000 };
      if (s.phase !== 'writing') return s;
      // Voting needs three answers so nobody is just voting for the only other one.
      if (s.answers.length < 3) return { ...s, phase: 'reveal', endsAt: null };
      return { ...s, phase: 'voting', votes: {}, endsAt: now + secs.vote * 1000 };
    }
    case 'closeVoting':
      return s.phase === 'voting' ? { ...s, phase: 'reveal', endsAt: null } : s;
    case 'finish':
      return s.phase === 'lobby' || s.phase === 'finale' ? s : { ...s, phase: 'finale', endsAt: null };
    case 'next':
      if (s.phase !== 'reveal') return s;
      return last ? { ...s, phase: 'finale', endsAt: null }
        : { ...s, phase: 'intro', round: s.round + 1, answers: [], votes: {}, endsAt: null };
  }
}
