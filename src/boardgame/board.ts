export type SpaceType = 'plain' | 'thankful' | 'scripture' | 'wander' | 'grace' | 'share' | 'home';

export interface ScriptureCard { q: string; a: string }
export interface GraceCard { text: string }

export interface BoardDef {
  id: string; date: string; title: string;
  /** Space type for index 0..size-2; the last index is always 'home'. */
  spaces: SpaceType[];
  scriptureCards: ScriptureCard[];
  graceCards: GraceCard[];
}

/** "The Road Back Home" — CFM week 47 (2026-11-16): Hosea 1-6,10-14; Joel. "I Will Love Them Freely." */
const HOSEA_JOEL: BoardDef = {
  id: 'hosea-joel',
  date: '2026-11-16',
  title: 'The Road Back Home',
  spaces: [
    'plain', 'thankful', 'scripture', 'plain', 'wander', 'grace',
    'plain', 'share', 'scripture', 'thankful', 'plain', 'wander',
    'grace', 'plain', 'scripture', 'share', 'thankful', 'plain',
    'wander', 'scripture', 'plain', 'grace', 'thankful', 'plain',
    'scripture', 'share', 'wander', 'thankful', 'scripture',
  ],
  scriptureCards: [
    { q: 'God compares His love for us to what kind of relationship in Hosea?', a: 'A marriage — He loves us even when we stray. (Hosea 1-3)' },
    { q: "Hosea's wife left him, but what did he do?", a: 'He kept loving her and brought her back — just like God does with us.' },
    { q: 'Hosea 2:19 says God will betroth (promise Himself to) us forever in what two things?', a: 'Lovingkindness and mercy.' },
    { q: 'What does Joel say God will pour out on His people?', a: 'His Spirit. (Joel 2:28)' },
    { q: 'Joel 2:13 says to "rend your heart" instead of what?', a: 'Instead of just outward signs of being sorry — really change on the inside.' },
    { q: 'True or False: God stops loving us when we make mistakes.', a: 'False — He keeps calling us back, every time.' },
    { q: "Name one way we can \"return\" to God when we've wandered.", a: 'Pray, repent, read scriptures, talk to Him — any honest answer counts!' },
    { q: "Was Hosea's message to Israel mainly a warning or an invitation?", a: 'Both — but mostly an invitation to come back to God’s love.' },
  ],
  graceCards: [
    { text: '"I will love thee freely." — Hosea 14:4' },
    { text: '"I will betroth thee unto me forever." — Hosea 2:19' },
    { text: "God's arms are always open, no matter how far you've wandered." },
    { text: "Heavenly Father's love for you never runs out — not even on your worst day." },
    { text: "Coming back to God is always welcomed. It's never too late." },
    { text: '"Rend your heart" — being truly sorry matters more than just looking sorry. (Joel 2:13)' },
  ],
};

export const BOARDS: BoardDef[] = [HOSEA_JOEL];
const localToday = () => new Date().toLocaleDateString('en-CA');
/** This week's board, or the most recent one before today. */
export function todaysBoard(today = localToday()): BoardDef {
  const past = BOARDS.filter((b) => b.date <= today).sort((a, b) => (a.date < b.date ? 1 : -1));
  return past[0] ?? BOARDS[BOARDS.length - 1];
}
export const boardFor = (id?: string): BoardDef => BOARDS.find((b) => b.id === id) ?? todaysBoard();
/** The Home-screen banner shows for a board's whole CFM week (its date through 6 days later). */
export const isBoardGameWeek = (today = localToday()) => BOARDS.some((b) => {
  const days = Math.floor((Date.parse(today) - Date.parse(b.date)) / 86_400_000);
  return days >= 0 && days < 7;
});

export const HOME_INDEX = (b: BoardDef) => b.spaces.length; // one past the last listed space
export const spaceType = (b: BoardDef, pos: number): SpaceType => (pos >= HOME_INDEX(b) ? 'home' : b.spaces[pos]);

/** Row-major reading order for a zigzag (boustrophedon) board, so a CSS grid auto-flow renders it as a snaking path. */
export function snakeOrder(n: number, cols: number): number[] {
  const order: number[] = [];
  for (let start = 0, row = 0; start < n; start += cols, row++) {
    const end = Math.min(start + cols, n);
    const row_ = [...Array(end - start).keys()].map((i) => start + i);
    order.push(...(row % 2 === 0 ? row_ : row_.reverse()));
  }
  return order;
}
