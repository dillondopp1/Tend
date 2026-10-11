import { describe, it, expect } from 'vitest';
import { learningFor } from './learning';
import type { Week } from './api';

const card = (type: string, text: string, ref?: string) => (ref ? { type, text, ref } : { type, text }) as never;
const week: Week = {
  id: 42, start_date: '2026-10-12', end_date: '2026-10-18', title: 'T', scripture_block: 'Isaiah 58–66', manual_url: 'u',
  key_phrase: 'beauty for ashes',
  content: {
    keyPhraseRef: 'Isaiah 61:3',
    sparks: [
      { day: 1, section: 's1', manualAnchor: 'u', phrase: 'undo the heavy burdens',
        cards: [card('hook', 'Hook one.'), card('verse', 'to undo the heavy burdens', 'Isaiah 58:6'), card('meaning', 'Fasting blesses others. More text.'), card('try', 'Help someone.')] },
      { day: 2, section: 's2', manualAnchor: 'u', phrase: 'call the sabbath a delight',
        cards: [card('hook', 'Hook two.'), card('verse', 'call the sabbath a delight', 'Isaiah 58:13'), card('meaning', 'Sabbath joy.'), card('try', 'Plan Sunday.')] },
    ],
  },
};

describe('learningFor', () => {
  it('uses that day’s phrase, verse ref, meaning and try', () => {
    const l = learningFor(week, '2026-10-13');
    expect(l.phrase).toBe('call the sabbath a delight');
    expect(l.ref).toBe('Isaiah 58:13');
    expect(l.tryText).toBe('Plan Sunday.');
    expect(l.lines).toContain('Try this today: Plan Sunday.');
    expect(l.lines.some((x) => x.includes('beauty for ashes'))).toBe(true); // weekly key phrase still drifts by
  });

  it('changes every day', () => {
    expect(learningFor(week, '2026-10-12').phrase).toBe('undo the heavy burdens');
    expect(learningFor(week, '2026-10-12').meaning).toBe('Fasting blesses others.');
  });

  it('falls back to the weekly key phrase when a day has no phrase', () => {
    const w = { ...week, content: { ...week.content, sparks: [{ ...week.content.sparks![0], phrase: undefined }] } };
    const l = learningFor(w, '2026-10-12');
    expect(l.phrase).toBe('beauty for ashes');
    expect(l.ref).toBe('Isaiah 61:3');
  });
});
