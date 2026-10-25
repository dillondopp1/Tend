// Halloween costume art for the shared pet rig (viewBox 0 0 200 200; body bean spans y 48–186,
// x 28–172; head top centre ≈ (100, 48); eyes at y ≈ 104). Every piece fits all species and colours.
export type Slot = 'head' | 'body' | 'full';
export interface Outfit { head?: string; body?: string; full?: string }
export interface CostumeItem { id: string; slot: Slot; name: string; price: number }

export const HALLOWEEN: CostumeItem[] = [
  { id: 'hw_bat_ears', slot: 'head', name: 'Bat ears', price: 80 },
  { id: 'hw_cat_ears', slot: 'head', name: 'Cat-ear headband', price: 80 },
  { id: 'hw_witch_hat', slot: 'head', name: 'Witch hat', price: 100 },
  { id: 'hw_pumpkin_cap', slot: 'head', name: 'Pumpkin cap', price: 100 },
  { id: 'hw_wizard_hat', slot: 'head', name: 'Wizard hat', price: 120 },
  { id: 'hw_scarecrow_scarf', slot: 'body', name: 'Scarecrow scarf', price: 90 },
  { id: 'hw_hero_cape', slot: 'body', name: 'Superhero cape', price: 130 },
  { id: 'hw_vampire_cape', slot: 'body', name: 'Vampire cape', price: 150 },
  { id: 'hw_bat_wings', slot: 'body', name: 'Bat wings', price: 150 },
  { id: 'hw_ghost', slot: 'full', name: 'Ghost sheet', price: 300 },
  { id: 'hw_mummy', slot: 'full', name: 'Mummy wraps', price: 300 },
  { id: 'hw_pumpkin_suit', slot: 'full', name: 'Pumpkin suit', price: 350 },
];

/** Applies the slot rules: a full costume replaces head + body; head/body replace a full costume. */
export function wear(outfit: Outfit, item: CostumeItem): Outfit {
  if (item.slot === 'full') return { full: item.id };
  const { full: _drop, ...rest } = outfit; // eslint-disable-line @typescript-eslint/no-unused-vars
  return { ...rest, [item.slot]: item.id };
}
export function takeOff(outfit: Outfit, item: CostumeItem): Outfit {
  const next = { ...outfit }; delete next[item.slot]; return next;
}

const INK = '#2b2140';

/** Drawn before the ears and body: capes and wings. */
export function BehindLayer({ outfit }: { outfit?: Outfit }) {
  switch (outfit?.body) {
    case 'hw_vampire_cape':
      return <g>
        <path d="M44 84 Q16 150 26 194 L174 194 Q184 150 156 84 Z" fill="#1f1830" />
        <path d="M50 92 Q30 150 38 190 L162 190 Q170 150 150 92 Z" fill="#c2253a" />
        <path d="M58 88 L34 52 L74 78 Z M142 88 L166 52 L126 78 Z" fill="#1f1830" />
      </g>;
    case 'hw_hero_cape':
      return <path d="M52 86 Q24 140 18 196 Q70 186 100 192 Q140 186 190 198 Q176 140 148 86 Z" fill="#e5484d" />;
    case 'hw_bat_wings':
      return <g fill="#2b2140">
        {[-1, 1].map((d) => <path key={d} transform={d < 0 ? undefined : 'translate(200 0) scale(-1 1)'}
          d="M44 104 Q20 70 2 78 Q12 92 8 106 Q20 100 22 116 Q32 108 36 124 Q40 114 48 120 Z" />)}
      </g>;
    default: return null;
  }
}

/** Drawn over the body but under the face: full costumes. */
export function FullLayer({ outfit }: { outfit?: Outfit }) {
  switch (outfit?.full) {
    case 'hw_ghost':
      return <g>
        <path d="M100 24 C154 24 176 70 176 120 L176 182 Q164 194 152 182 Q140 196 126 182 Q113 196 100 182 Q87 196 74 182 Q60 196 48 182 Q36 194 24 182 L24 120 C24 70 46 24 100 24 Z"
          fill="#ffffff" stroke="#e4dcf5" strokeWidth="3" />
        <ellipse cx="62" cy="150" rx="10" ry="16" fill="#efe9ff" />
      </g>;
    case 'hw_mummy':
      return <g stroke="#cfc6b8" strokeWidth="1.5" fill="#f7f1e3">
        <path d="M30 140 L170 118 L172 132 L32 156 Z" />
        <path d="M30 162 L168 146 L166 160 L36 176 Z" />
        <path d="M44 178 L156 170 L150 182 L56 188 Z" />
        <path d="M36 96 L66 84 L70 94 L38 108 Z" />
        <path d="M134 84 L164 96 L162 108 L130 94 Z" />
        <path d="M58 62 L142 56 L146 66 L56 72 Z" />
      </g>;
    case 'hw_pumpkin_suit':
      return <g>
        <ellipse cx="100" cy="152" rx="80" ry="42" fill="#ff8a1f" />
        <g fill="none" stroke="#e06a00" strokeWidth="4">
          <path d="M100 112 Q92 152 100 192" /><path d="M66 116 Q52 152 64 190" /><path d="M134 116 Q148 152 136 190" />
        </g>
        <path d="M100 112 Q112 100 120 106 Q110 112 104 116 Z" fill="#3f9a3a" />
      </g>;
    default: return null;
  }
}

/** Drawn after the face: hats and scarves. */
export function FrontLayer({ outfit }: { outfit?: Outfit }) {
  return <g>
    {outfit?.body === 'hw_scarecrow_scarf' && <g>
      <path d="M44 132 Q100 156 156 132 L158 146 Q100 170 42 146 Z" fill="#e8743b" />
      <path d="M58 140 L58 150 M78 146 L78 156 M100 148 L100 160 M122 146 L122 156 M142 140 L142 150" stroke="#b5481f" strokeWidth="3" />
      <path d="M128 148 L140 186 L124 184 L118 150 Z" fill="#e8743b" />
      <path d="M126 186 L122 194 M132 186 L132 195 M138 186 L141 194" stroke="#d9a441" strokeWidth="3" strokeLinecap="round" />
    </g>}
    {outfit?.head && !outfit.full && <HeadItem id={outfit.head} />}
  </g>;
}

function HeadItem({ id }: { id: string }) {
  switch (id) {
    case 'hw_bat_ears':
      return <g>
        <path d="M58 62 Q100 40 142 62" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
        {[-1, 1].map((d) => <path key={d} fill={INK} transform={d < 0 ? undefined : 'translate(200 0) scale(-1 1)'}
          d="M66 56 L48 8 Q60 22 64 18 Q70 30 76 26 Q80 40 86 48 Z" />)}
      </g>;
    case 'hw_cat_ears':
      return <g>
        <path d="M54 66 Q100 36 146 66" stroke="#7c5cff" strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d="M64 56 L68 16 L92 44 Z M136 56 L132 16 L108 44 Z" fill={INK} />
        <path d="M70 48 L72 28 L84 42 Z M130 48 L128 28 L116 42 Z" fill="#ff8fab" />
      </g>;
    case 'hw_witch_hat':
      return <g>
        <path d="M66 52 Q86 30 96 -4 Q104 18 120 26 Q112 34 134 52 Z" fill="#4b2a7a" />
        <rect x="70" y="40" width="62" height="9" rx="3" fill="#ff8a1f" />
        <ellipse cx="100" cy="54" rx="62" ry="10" fill="#3a1f60" />
      </g>;
    case 'hw_pumpkin_cap':
      return <g>
        <path d="M54 58 Q54 22 100 20 Q146 22 146 58 Q100 66 54 58 Z" fill="#ff8a1f" />
        <path d="M100 22 Q92 40 100 62 M76 26 Q70 42 76 60 M124 26 Q130 42 124 60" stroke="#e06a00" strokeWidth="3" fill="none" />
        <path d="M98 22 Q96 10 104 4 L108 8 Q102 12 104 22 Z" fill="#3f9a3a" />
      </g>;
    case 'hw_wizard_hat':
      return <g>
        <path d="M68 52 L98 -8 L132 52 Z" fill="#3d5ad8" />
        <ellipse cx="100" cy="54" rx="58" ry="9" fill="#2c44b0" />
        <path d="M92 22 l3 6 6 1 -5 4 1 6 -5 -3 -5 3 1 -6 -5 -4 6 -1 Z" fill="#ffd23d" />
        <circle cx="112" cy="38" r="3" fill="#ffd23d" /><circle cx="84" cy="40" r="2" fill="#ffd23d" />
      </g>;
    default: return null;
  }
}
