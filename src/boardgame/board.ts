export type Resource = 'faith' | 'mercy' | 'thanks' | 'word';
export const RESOURCES: Resource[] = ['faith', 'mercy', 'thanks', 'word'];
export const RESOURCE_ICON: Record<Resource, string> = { faith: '🙏', mercy: '💛', thanks: '🦃', word: '📖' };
export const RESOURCE_NAME: Record<Resource, string> = { faith: 'Faith', mercy: 'Mercy', thanks: 'Thanks', word: 'Word' };

export interface Tile { id: number; resource: Resource; number: number; label: string }

export interface ScriptureCard { q: string; a: string }
export interface GraceCard { text: string }

export interface BoardDef {
  id: string; date: string; title: string;
  tiles: Tile[];
  scriptureCards: ScriptureCard[];
  graceCards: GraceCard[];
}

/** "The Road Back Home" — CFM week 47 (2026-11-16): Hosea 1-6,10-14; Joel. "I Will Love Them Freely." */
const HOSEA_JOEL: BoardDef = {
  id: 'hosea-joel',
  date: '2026-11-16',
  title: 'The Road Back Home',
  tiles: [
    { id: 0, resource: 'faith', number: 2, label: 'Return' },
    { id: 1, resource: 'mercy', number: 3, label: 'Promise' },
    { id: 2, resource: 'thanks', number: 4, label: 'Thanksgiving' },
    { id: 3, resource: 'word', number: 5, label: 'Scripture' },
    { id: 4, resource: 'faith', number: 6, label: 'Return' },
    { id: 5, resource: 'mercy', number: 8, label: 'Promise' },
    { id: 6, resource: 'thanks', number: 9, label: 'Thanksgiving' },
    { id: 7, resource: 'word', number: 10, label: 'Scripture' },
    { id: 8, resource: 'faith', number: 11, label: 'Return' },
    { id: 9, resource: 'mercy', number: 12, label: 'Promise' },
    { id: 10, resource: 'thanks', number: 4, label: 'Thanksgiving' },
    { id: 11, resource: 'word', number: 8, label: 'Scripture' },
  ],
  scriptureCards: [
    { q: 'God compares His love for us to what kind of relationship in Hosea?', a: 'A marriage. He loves us even when we stray. (Hosea 1-3)' },
    { q: "Hosea's wife left him, but what did he do?", a: 'He kept loving her and brought her back, the same way God brings us back.' },
    { q: 'Hosea 2:19 says God will betroth (promise Himself to) us forever in what two things?', a: 'Lovingkindness and mercy.' },
    { q: 'What does Joel say God will pour out on His people?', a: 'His Spirit. (Joel 2:28)' },
    { q: 'Joel 2:13 says to "rend your heart" instead of what?', a: 'Instead of outward signs of being sorry. Change on the inside.' },
    { q: 'True or False: God stops loving us when we make mistakes.', a: 'False. He keeps calling us back.' },
    { q: "Name one way we can \"return\" to God when we've wandered.", a: 'Pray, repent, read scriptures, talk to Him. Any honest answer counts!' },
    { q: "Was Hosea's message to Israel mainly a warning or an invitation?", a: 'Both, but mostly an invitation to come back to God’s love.' },
  ],
  graceCards: [
    { text: '"I will love thee freely." Hosea 14:4' },
    { text: '"I will betroth thee unto me forever." Hosea 2:19' },
    { text: "God's arms stay open, no matter how far you've wandered." },
    { text: "Heavenly Father's love for you doesn't run out, not even on your worst day." },
    { text: "Coming back to God is welcomed. It's not too late." },
    { text: '"Rend your heart": being sorry on the inside matters more than looking sorry. (Joel 2:13)' },
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

export const MAX_SETTLERS_PER_TILE = 2;
export const MAX_BUILDINGS_PER_PLAYER = 3;
export const WIN_POINTS = 6;
export const ALTAR_COST: Record<Resource, number> = { faith: 1, mercy: 1, thanks: 1, word: 1 };
export const TEMPLE_COST: Partial<Record<Resource, number>> = { mercy: 2, word: 2 };
