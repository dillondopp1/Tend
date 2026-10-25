import type { SpeciesId } from '../domain/species';
import type { Mood } from '../domain/stats';
import type { Stage } from '../domain/growth';
import { BehindLayer, FullLayer, FrontLayer, type Outfit } from './costumes';

// One shared bean-shaped rig (body, belly, face, feet) plus per-species parts.
// Colours: [body, belly/face, accent (ears inner, nose, markings)].
type Palette = [string, string, string];

const PALETTES: Record<SpeciesId, [Palette, Palette, Palette]> = {
  fox:       [['#ff8a3d', '#fff3e6', '#3b2a2a'], ['#ffc3a0', '#fffaf4', '#b06a5a'], ['#5b4a8a', '#e9e3ff', '#2a2140']],
  bunny:     [['#f4ece4', '#ffffff', '#ff9fb5'], ['#ffd6e5', '#fff7fa', '#ff7fa3'], ['#6e6a86', '#d9d6ea', '#ffb3c8']],
  panda:     [['#ffffff', '#ffffff', '#2b2b35'], ['#fff1f6', '#ffffff', '#7a5a8a'], ['#e9e6f5', '#ffffff', '#1d1b2e']],
  cat:       [['#9aa3b5', '#eef0f5', '#ff9fb5'], ['#ffcf8a', '#fff6e8', '#ff8f8f'], ['#3a3550', '#8d86a8', '#ffb3c8']],
  puppy:     [['#d9a26b', '#fff2e0', '#6b4226'], ['#f5e6c8', '#fffaf0', '#c08a5a'], ['#4a4458', '#d8d2e8', '#2a2438']],
  owl:       [['#a87b5a', '#f3e2c8', '#ffb43d'], ['#c9b5e8', '#f3edff', '#ffb43d'], ['#3d4a6e', '#c9d3ee', '#ffd23d']],
  penguin:   [['#3a3f58', '#ffffff', '#ffa53d'], ['#6fb3e8', '#ffffff', '#ffa53d'], ['#5b3f7a', '#f3ebff', '#ffc23d']],
  axolotl:   [['#ffb3c8', '#ffe3ec', '#ff5f8f'], ['#c9f0e0', '#f0fff8', '#3dbf8f'], ['#7a6ad8', '#ddd6ff', '#ff7fd0']],
  red_panda: [['#d9572b', '#fff1e3', '#3b231b'], ['#f2a06b', '#fff8ee', '#8a4a30'], ['#6a3b5a', '#f1dfe9', '#2a1a24']],
  otter:     [['#9a6a48', '#f1dcc3', '#4a2f22'], ['#c7a07c', '#fbf0e2', '#6e4a34'], ['#4a5a70', '#d5dde8', '#252f3d']],
  frog:      [['#7ccf6a', '#e9f9d9', '#2f6b2a'], ['#ffd85a', '#fff6cf', '#a8862a'], ['#4a8ad8', '#dcecff', '#1f4a8a']],
  hedgehog:  [['#f2d3b0', '#fff4e6', '#7a5640'], ['#ffe0ea', '#fff8fb', '#b8768a'], ['#e6dcc9', '#fffaf0', '#4a4238']],
  lamb:      [['#fffaf2', '#ffe9d6', '#5a4a46'], ['#fff0f6', '#ffe0ec', '#8a5a6e'], ['#e8e3f5', '#cfc6e8', '#3d3550']],
  turtle:    [['#8fd17a', '#eaf8d9', '#5a8a3a'], ['#7ad1c4', '#e1fbf6', '#2f8a7a'], ['#d1a87a', '#fbeedd', '#8a5a2f']],
  koala:     [['#a9adb8', '#eef0f4', '#3a3a46'], ['#c9c0d8', '#f4f0fa', '#4a4058'], ['#7a7f8e', '#d8dbe3', '#24242e']],
};

// Five more colours shared by every animal; markings/details keep the species' classic accent.
const DYES: { name: string; body: string; belly: string }[] = [
  { name: 'Mint', body: '#8fe3c4', belly: '#effcf6' },
  { name: 'Sky', body: '#8cc8ff', belly: '#eef7ff' },
  { name: 'Lavender', body: '#c3a6ff', belly: '#f5efff' },
  { name: 'Rose', body: '#ff9ebb', belly: '#fff0f5' },
  { name: 'Sunny', body: '#ffd45c', belly: '#fff8e1' },
];

export const COLOR_NAMES = ['Classic', 'Pastel', 'Midnight', ...DYES.map((d) => d.name)];

export function swatch(species: SpeciesId, variant: number): Palette {
  const own = PALETTES[species];
  if (variant < own.length) return own[variant];
  const d = DYES[variant - own.length];
  return d ? [d.body, d.belly, own[0][2]] : own[0];
}

const STAGE_SCALE: Record<Stage, number> = { hatchling: 0.72, little: 0.82, young: 0.9, grown: 1, legendary: 1 };

function Ears({ s, c }: { s: SpeciesId; c: Palette }) {
  const [body, belly, acc] = c;
  switch (s) {
    case 'fox': case 'red_panda':
      return <g>
        <path d="M52 78 L60 22 L96 60 Z" fill={body} /><path d="M148 78 L140 22 L104 60 Z" fill={body} />
        <path d="M62 66 L64 38 L84 58 Z" fill={s === 'fox' ? acc : belly} /><path d="M138 66 L136 38 L116 58 Z" fill={s === 'fox' ? acc : belly} />
      </g>;
    case 'cat':
      return <g>
        <path d="M50 80 L56 28 L92 58 Z" fill={body} /><path d="M150 80 L144 28 L108 58 Z" fill={body} />
        <path d="M60 68 L62 42 L80 58 Z" fill={acc} /><path d="M140 68 L138 42 L120 58 Z" fill={acc} />
      </g>;
    case 'bunny':
      return <g>
        <ellipse cx="74" cy="34" rx="15" ry="38" fill={body} transform="rotate(-10 74 34)" />
        <ellipse cx="126" cy="34" rx="15" ry="38" fill={body} transform="rotate(10 126 34)" />
        <ellipse cx="74" cy="36" rx="7" ry="27" fill={acc} transform="rotate(-10 74 36)" />
        <ellipse cx="126" cy="36" rx="7" ry="27" fill={acc} transform="rotate(10 126 36)" />
      </g>;
    case 'panda':
      return <g><circle cx="56" cy="58" r="18" fill={acc} /><circle cx="144" cy="58" r="18" fill={acc} /></g>;
    case 'koala':
      return <g>
        <circle cx="44" cy="70" r="27" fill={body} /><circle cx="156" cy="70" r="27" fill={body} />
        <circle cx="46" cy="72" r="16" fill={belly} /><circle cx="154" cy="72" r="16" fill={belly} />
      </g>;
    case 'puppy':
      return <g>
        <ellipse cx="42" cy="96" rx="16" ry="32" fill={acc} transform="rotate(18 42 96)" />
        <ellipse cx="158" cy="96" rx="16" ry="32" fill={acc} transform="rotate(-18 158 96)" />
      </g>;
    case 'otter':
      return <g><circle cx="56" cy="64" r="11" fill={body} /><circle cx="144" cy="64" r="11" fill={body} /><circle cx="56" cy="64" r="5" fill={acc} /><circle cx="144" cy="64" r="5" fill={acc} /></g>;
    case 'owl':
      return <g><path d="M48 70 L52 32 L80 56 Z" fill={body} /><path d="M152 70 L148 32 L120 56 Z" fill={body} /></g>;
    case 'axolotl':
      return <g fill={acc}>
        {[-1, 1].map((d) => <g key={d}>
          <ellipse cx={100 + d * 66} cy="74" rx="20" ry="7" transform={`rotate(${d * -25} ${100 + d * 66} 74)`} />
          <ellipse cx={100 + d * 72} cy="92" rx="20" ry="7" />
          <ellipse cx={100 + d * 66} cy="110" rx="20" ry="7" transform={`rotate(${d * 25} ${100 + d * 66} 110)`} />
        </g>)}
      </g>;
    case 'lamb':
      return <g>
        <ellipse cx="38" cy="90" rx="20" ry="10" fill={belly} transform="rotate(25 38 90)" />
        <ellipse cx="162" cy="90" rx="20" ry="10" fill={belly} transform="rotate(-25 162 90)" />
      </g>;
    case 'hedgehog':
      return <g fill={acc}>
        {Array.from({ length: 11 }, (_, i) => {
          const a = Math.PI * (1.05 + (i / 10) * 0.9);
          const x = 100 + Math.cos(a) * 66, y = 112 + Math.sin(a) * 62;
          const x2 = 100 + Math.cos(a) * 92, y2 = 112 + Math.sin(a) * 86;
          const n = 0.16;
          return <path key={i} d={`M${100 + Math.cos(a - n) * 64} ${112 + Math.sin(a - n) * 60} L${x2} ${y2} L${100 + Math.cos(a + n) * 64} ${112 + Math.sin(a + n) * 60} Z`} data-x={x} data-y={y} />;
        })}
      </g>;
    default:
      return null;
  }
}

function Back({ s, c }: { s: SpeciesId; c: Palette }) {
  const [body, , acc] = c;
  if (s === 'turtle') return <g>
    <ellipse cx="100" cy="128" rx="80" ry="62" fill={acc} />
    <path d="M60 110 L80 92 L120 92 L140 110 L120 128 L80 128 Z" fill={body} opacity="0.35" />
  </g>;
  if (s === 'fox' || s === 'red_panda' || s === 'cat') {
    const tip = s === 'red_panda' ? acc : '#fff8ee';
    return <g>
      <path d="M150 160 Q196 150 186 104 Q178 82 166 96 Q172 130 140 146 Z" fill={body} />
      {s !== 'cat' && <path d="M186 104 Q178 82 166 96 Q170 108 176 112 Q186 112 186 104 Z" fill={tip} />}
    </g>;
  }
  if (s === 'lamb') return <g fill={body}>
    {[[52, 74], [76, 56], [100, 50], [124, 56], [148, 74], [40, 100], [160, 100]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="22" />)}
  </g>;
  return null;
}

function Face({ s, c, mood }: { s: SpeciesId; c: Palette; mood: Mood }) {
  const [, belly, acc] = c;
  const ink = '#2b2140';
  const eyeY = s === 'frog' ? 64 : 104;
  const eyeDx = s === 'frog' ? 34 : 26;
  const sleepy = mood === 'sleepy' || mood === 'misses-you';
  const eyes = sleepy
    ? <g stroke={ink} strokeWidth="4" strokeLinecap="round" fill="none">
        <path d={`M${100 - eyeDx - 9} ${eyeY} Q${100 - eyeDx} ${eyeY + 6} ${100 - eyeDx + 9} ${eyeY}`} />
        <path d={`M${100 + eyeDx - 9} ${eyeY} Q${100 + eyeDx} ${eyeY + 6} ${100 + eyeDx + 9} ${eyeY}`} />
      </g>
    : <g className="pet-eyes" style={{ transformOrigin: `100px ${eyeY}px` }}>
        {[-1, 1].map((d) => <g key={d}>
          <ellipse cx={100 + d * eyeDx} cy={eyeY} rx="9" ry={mood === 'thriving' ? 11 : 10} fill={ink} />
          <circle cx={100 + d * eyeDx + 3} cy={eyeY - 4} r="3.5" fill="#fff" />
        </g>)}
      </g>;
  const smile = mood === 'thriving'
    ? <path d="M88 124 Q100 138 112 124 Z" fill="#ff6b8a" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
    : mood === 'misses-you'
      ? <circle cx="100" cy="128" r="3.5" fill={ink} />
      : <path d="M90 124 Q100 132 110 124" stroke={ink} strokeWidth="3.5" fill="none" strokeLinecap="round" />;
  return <g>
    {s === 'panda' && <g fill={acc}><ellipse cx="74" cy="104" rx="16" ry="19" transform="rotate(-20 74 104)" /><ellipse cx="126" cy="104" rx="16" ry="19" transform="rotate(20 126 104)" /></g>}
    {s === 'red_panda' && <g fill={belly}><ellipse cx="72" cy="94" rx="12" ry="8" /><ellipse cx="128" cy="94" rx="12" ry="8" /><ellipse cx="100" cy="122" rx="30" ry="18" /></g>}
    {s === 'fox' && <path d="M48 100 Q70 140 100 132 Q130 140 152 100 Q130 116 100 112 Q70 116 48 100 Z" fill={belly} />}
    {s === 'owl' && <g><circle cx="74" cy="104" r="20" fill={belly} /><circle cx="126" cy="104" r="20" fill={belly} /></g>}
    {s === 'frog' && <g><circle cx="66" cy="64" r="20" fill={c[0]} /><circle cx="134" cy="64" r="20" fill={c[0]} /><circle cx="66" cy="64" r="14" fill="#fff" /><circle cx="134" cy="64" r="14" fill="#fff" /></g>}
    {eyes}
    <ellipse cx="68" cy="122" rx="9" ry="5" fill="#ff8fab" opacity="0.55" />
    <ellipse cx="132" cy="122" rx="9" ry="5" fill="#ff8fab" opacity="0.55" />
    {s === 'owl' || s === 'penguin'
      ? <path d="M92 114 L108 114 L100 126 Z" fill={acc} />
      : s === 'koala'
        ? <ellipse cx="100" cy="117" rx="10" ry="12" fill={acc} />
        : s === 'frog' || s === 'axolotl' || s === 'turtle'
          ? null
          : <path d="M94 114 Q100 112 106 114 Q104 120 100 121 Q96 120 94 114 Z" fill={s === 'bunny' || s === 'cat' || s === 'hedgehog' ? '#ff7f9f' : '#2b2140'} />}
    {(s === 'cat' || s === 'otter') && <g stroke={ink} strokeWidth="2" strokeLinecap="round" opacity="0.6">
      <path d="M58 118 L36 114" /><path d="M58 124 L36 126" /><path d="M142 118 L164 114" /><path d="M142 124 L164 126" />
    </g>}
    {s === 'koala' ? null : smile}
  </g>;
}

export interface PetProps {
  species: SpeciesId; variant?: number; mood?: Mood; stage?: Stage; size?: number; animate?: boolean; outfit?: Outfit;
}

export default function Pet({ species, variant = 0, mood = 'content', stage = 'grown', size = 200, animate = true, outfit }: PetProps) {
  const c = swatch(species, variant);
  const [body, belly] = c;
  const scale = STAGE_SCALE[stage];
  const anim = !animate ? '' : mood === 'sleepy' || mood === 'misses-you' ? 'pet-breathe' : 'pet-bounce';
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={`${species} pet`} className="pet">
      <ellipse cx="100" cy="190" rx={58 * scale} ry="7" fill="#2b2140" opacity="0.10" />
      <g className={anim} style={{ transformOrigin: '100px 190px' }}>
        <g transform={`translate(100 190) scale(${scale}) translate(-100 -190)`}>
          <Back s={species} c={c} />
          <BehindLayer outfit={outfit} />
          {outfit?.full !== 'hw_ghost' && <Ears s={species} c={c} />}
          <g>
            <ellipse cx="74" cy="182" rx="18" ry="10" fill={body} />
            <ellipse cx="126" cy="182" rx="18" ry="10" fill={body} />
            <path d="M100 48 C150 48 172 86 172 124 C172 166 142 186 100 186 C58 186 28 166 28 124 C28 86 50 48 100 48 Z" fill={body} />
            <ellipse cx="100" cy="152" rx={species === 'penguin' ? 50 : 40} ry={species === 'penguin' ? 34 : 28} fill={belly} />
            {species === 'penguin' && <path d="M58 70 Q100 56 142 70 Q160 110 130 124 Q100 110 70 124 Q40 110 58 70 Z" fill={body} />}
            {species === 'penguin' && <ellipse cx="100" cy="112" rx="56" ry="26" fill={belly} />}
            {(species === 'owl' || species === 'penguin') && <g fill={body}>
              <ellipse cx="30" cy="140" rx="12" ry="26" transform="rotate(20 30 140)" />
              <ellipse cx="170" cy="140" rx="12" ry="26" transform="rotate(-20 170 140)" />
            </g>}
            <FullLayer outfit={outfit} />
            <Face s={species} c={c} mood={mood} />
          </g>
          <FrontLayer outfit={outfit} />
          {stage === 'legendary' && !outfit?.head && !outfit?.full && <g fill="#ffd23d">
            <path d="M70 40 L82 20 L92 36 L100 14 L108 36 L118 20 L130 40 Z" />
          </g>}
        </g>
      </g>
      {mood === 'misses-you' && <text x="150" y="40" fontSize="22" fill="#8a7f9e" className="pet-zzz">z z z</text>}
    </svg>
  );
}

export function Egg({ size = 200, cracking = false }: { size?: number; cracking?: boolean }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={cracking ? 'egg-crack' : 'egg-wobble'} aria-label="egg">
      <ellipse cx="100" cy="190" rx="50" ry="7" fill="#2b2140" opacity="0.1" />
      <path d="M100 20 C146 20 166 100 166 132 C166 170 138 190 100 190 C62 190 34 170 34 132 C34 100 54 20 100 20 Z" fill="#fff" stroke="#e4dcf5" strokeWidth="4" />
      <g fill="#ffd6a8"><circle cx="76" cy="92" r="10" /><circle cx="128" cy="70" r="8" /><circle cx="118" cy="140" r="13" /><circle cx="70" cy="150" r="7" /></g>
      {cracking && <path d="M40 120 L64 108 L80 124 L100 104 L118 124 L136 106 L160 120" stroke="#2b2140" strokeWidth="4" fill="none" strokeLinejoin="round" />}
    </svg>
  );
}
