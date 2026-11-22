/** A describing word the judge flips. `lens` ties it back to the week's scripture on the reveal screen. */
export interface GreenCard { word: string; lens?: { ref: string; text: string } }

export interface DeckDef {
  id: string; date: string; title: string;
  greens: GreenCard[];
  reds: string[];
}

/** CFM week 47 (2026-11-16): Hosea 1-6, 10-14; Joel. "I Will Love Them Freely." Plus Thanksgiving. */
const HOSEA_JOEL: DeckDef = {
  id: 'hosea-joel',
  date: '2026-11-16',
  title: 'Harvest Picks',
  greens: [
    { word: 'Faithful', lens: { ref: 'Hosea 2:20', text: 'I will even betroth thee unto me in faithfulness: and thou shalt know the Lord.' } },
    { word: 'Forgiving', lens: { ref: 'Hosea 14:4', text: 'I will heal their backsliding, I will love them freely.' } },
    { word: 'Loyal', lens: { ref: 'Hosea 6:6', text: 'For I desired mercy, and not sacrifice; and the knowledge of God more than burnt offerings.' } },
    { word: 'Merciful', lens: { ref: 'Joel 2:13', text: 'He is gracious and merciful, slow to anger, and of great kindness.' } },
    { word: 'Thankful', lens: { ref: 'Joel 2:26', text: 'And ye shall eat in plenty, and be satisfied, and praise the name of the Lord your God.' } },
    { word: 'Gentle', lens: { ref: 'Hosea 11:4', text: 'I drew them with cords of a man, with bands of love.' } },
    { word: 'Stubborn', lens: { ref: 'Hosea 4:16', text: 'For Israel slideth back as a backsliding heifer.' } },
    { word: 'Hungry', lens: { ref: 'Joel 1:4', text: 'That which the palmerworm hath left hath the locust eaten.' } },
    { word: 'Hopeful', lens: { ref: 'Hosea 2:15', text: 'And the valley of Achor for a door of hope.' } },
    { word: 'Generous', lens: { ref: 'Joel 2:28', text: 'I will pour out my spirit upon all flesh.' } },
    { word: 'Loud', lens: { ref: 'Joel 2:1', text: 'Blow ye the trumpet in Zion, and sound an alarm in my holy mountain.' } },
    { word: 'Unstoppable', lens: { ref: 'Joel 2:7', text: 'They shall run like mighty men; they shall climb the wall like men of war.' } },
    { word: 'Healing', lens: { ref: 'Hosea 6:1', text: 'Come, and let us return unto the Lord: for he hath torn, and he will heal us.' } },
    { word: 'Restored', lens: { ref: 'Joel 2:25', text: 'And I will restore to you the years that the locust hath eaten.' } },
    { word: 'Brave' },
    { word: 'Lost' },
    { word: 'Wild' },
    { word: 'Cozy' },
    { word: 'Dramatic' },
    { word: 'Overrated' },
    { word: 'Sweet' },
    { word: 'Awkward' },
    { word: 'Stuffed' },
    { word: 'Sticky' },
  ],
  reds: [
    // scripture
    'Hosea', 'Gomer coming home', 'The prophet Joel', 'A swarm of locusts', 'Jonah inside the whale', 'Nephi',
    'Captain Moroni', 'Daniel in the lions\' den', 'The prodigal son', 'One lost sheep', 'Noah\'s ark', 'Goliath',
    'The brother of Jared\'s glowing stones', 'Samuel the Lamanite on the wall', 'The Liahona', 'Ammon at the waters of Sebus',
    'Joseph\'s coat of many colors', 'Moses parting the Red Sea', 'Abinadi', 'The Good Samaritan', 'The 2,000 stripling warriors',
    'A trumpet in Zion', 'The widow\'s mite', 'Peter walking on water', 'Feeding the 5,000', 'Elijah calling down fire',
    'Ruth', 'Queen Esther', 'The ten lepers', 'The tower of Babel',
    // church life
    'Seminary at 6 a.m.', 'Fast Sunday', 'The ward potluck', 'Green Jell-O', 'Funeral potatoes', 'The sacrament',
    'Family home evening', 'The bishop', 'Youth conference', 'A missionary farewell', 'A stake dance', 'Primary songs',
    'Testimony meeting', 'Girls camp', 'Scout camp in the rain', 'General Conference weekend', 'A temple trip',
    'A baptism day', 'Our Sunday School teacher', 'The hymnbook',
    // Thanksgiving
    'Pumpkin pie', 'A 20-pound turkey', 'Grandma\'s stuffing', 'The last dinner roll', 'Black Friday', 'The Macy\'s parade',
    'Leftovers', 'The kids\' table', 'Football on TV', 'Cranberry sauce from a can', 'The Pilgrims', 'Mashed potatoes',
    'A food coma', 'The wishbone',
    // life
    'My little brother', 'The group chat', 'My phone at 1%', 'Mom\'s minivan', 'A pop quiz', 'A snow day',
    'Homework due tomorrow', 'Taco Tuesday', 'The school cafeteria', 'A golden retriever', 'Grandpa\'s jokes',
    'Costco samples', 'Idaho potatoes', 'A trampoline', 'Duct tape', 'Hot Cheetos', 'A math test', 'My first car',
    'The dentist', 'Summer break', 'A wet sock', 'The Wi-Fi going out', 'Mondays', 'A bear hug', 'Pizza night',
    'A moose', 'The Snake River', 'A lost dog finding its way home', 'Grandma', 'A warm blanket',
  ],
};

export const DECKS: DeckDef[] = [HOSEA_JOEL];
const localToday = () => new Date().toLocaleDateString('en-CA');
/** This week's deck, or the most recent one before today. */
export function todaysDeck(today = localToday()): DeckDef {
  const past = DECKS.filter((d) => d.date <= today).sort((a, b) => (a.date < b.date ? 1 : -1));
  return past[0] ?? DECKS[DECKS.length - 1];
}
export const deckFor = (id?: string): DeckDef => DECKS.find((d) => d.id === id) ?? todaysDeck();
/** The Home-screen banner shows for a deck's whole CFM week (its date through 6 days later). */
export const isBoardGameWeek = (today = localToday()) => DECKS.some((d) => {
  const days = Math.floor((Date.parse(today) - Date.parse(d.date)) / 86_400_000);
  return days >= 0 && days < 7;
});

export const HAND_SIZE = 5;
export const WIN_GREENS = 4;
