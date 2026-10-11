export const SPECIES = [
  { id: 'fox', label: 'Fox' },
  { id: 'bunny', label: 'Bunny' },
  { id: 'panda', label: 'Panda' },
  { id: 'cat', label: 'Cat' },
  { id: 'puppy', label: 'Puppy' },
  { id: 'owl', label: 'Owl' },
  { id: 'penguin', label: 'Penguin' },
  { id: 'axolotl', label: 'Axolotl' },
  { id: 'red_panda', label: 'Red Panda' },
  { id: 'otter', label: 'Otter' },
  { id: 'frog', label: 'Frog' },
  { id: 'hedgehog', label: 'Hedgehog' },
  { id: 'lamb', label: 'Lamb' },
  { id: 'turtle', label: 'Turtle' },
  { id: 'koala', label: 'Koala' },
] as const;

export type SpeciesId = (typeof SPECIES)[number]['id'];
