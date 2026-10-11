import { useMemo } from 'react';

const COLORS = ['#7c5cff', '#ff8a5c', '#ffd23d', '#2fbf71', '#ff7fa3', '#4ab3ff'];

export default function Confetti({ count = 60 }: { count?: number }) {
  const bits = useMemo(() => Array.from({ length: count }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 0.8, dur: 1.6 + Math.random() * 1.4,
    color: COLORS[i % COLORS.length], rot: Math.random() * 360,
  })), [count]);
  return <div className="confetti" aria-hidden>
    {bits.map((b, i) => <i key={i} style={{ left: `${b.left}%`, background: b.color, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s`, transform: `rotate(${b.rot}deg)` }} />)}
  </div>;
}
