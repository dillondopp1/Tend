// MOCKUP ONLY: pretend Talents/costume state kept in this browser, so Dillon can try the quiz and shop
// in a preview before the real server version exists. Never used on the live site.
import { useEffect, useState } from 'react';
import { isPreviewHost } from '../lib/preview';
import type { Outfit } from '../pet/costumes';

export interface MockState { talents: number; owned: string[]; outfit: Outfit; quizEarnedOn?: string }
const KEY = 'tend-mock-v1';
const EMPTY: MockState = { talents: 0, owned: [], outfit: {} };

export const mockEnabled = () => isPreviewHost(location.hostname) || location.hostname === 'localhost';

function read(): MockState {
  try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return EMPTY; }
}
const listeners = new Set<(s: MockState) => void>();
export function updateMock(f: (s: MockState) => MockState) {
  const next = f(read());
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode: state lasts this page only */ }
  listeners.forEach((l) => l(next));
}
export function useMock(): MockState {
  const [s, set] = useState(read);
  useEffect(() => { listeners.add(set); return () => { listeners.delete(set); }; }, []);
  return s;
}
export const todayLocal = () => new Date().toLocaleDateString('en-CA');
