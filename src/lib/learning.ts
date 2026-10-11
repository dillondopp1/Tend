import { sparkFor, dayOfWeek, type Week } from './api';

/** What the games teach on a given day: that day's Spark phrase, verse, meaning and try-this. */
export interface DayLearning {
  phrase: string; ref: string; meaning: string; verse: string; tryText: string;
  /** Lines that drift through the game backgrounds. */
  lines: string[];
}

const firstSentence = (s: string) => (s.match(/^.*?[.!?](\s|$)/)?.[0] ?? s).trim();

export function learningFor(week: Week, date: string): DayLearning {
  const c = week.content as { keyPhraseRef?: string; phraseMeaning?: string };
  const spark = sparkFor(week, dayOfWeek(week.start_date, date));
  const text = (type: string) => spark?.cards.find((k) => k.type === type)?.text ?? '';
  const verseCard = spark?.cards.find((k) => k.type === 'verse') as { ref: string; text: string } | undefined;
  const phrase = spark?.phrase ?? week.key_phrase;
  const ref = spark?.phrase && verseCard ? verseCard.ref : c.keyPhraseRef ?? '';
  const meaning = text('meaning') || c.phraseMeaning || '';
  const verse = verseCard?.text ?? '';
  const tryText = text('try');
  const weekly = week.key_phrase && week.key_phrase !== phrase ? `This week: “${week.key_phrase}” ${c.keyPhraseRef ?? ''}`.trim() : '';
  const lines = [
    verse && `“${verse}” ${ref}`,
    meaning,
    tryText && `Try this today: ${tryText}`,
    text('hook'),
    weekly,
  ].filter(Boolean);
  return { phrase, ref, meaning: firstSentence(meaning), verse, tryText, lines };
}
