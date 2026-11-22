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
  // Plain words people use. A few carry a verse from the week so the reveal can tie back to the lesson.
  greens: [
    { word: 'Loyal', lens: { ref: 'Hosea 2:20', text: 'I will even betroth thee unto me in faithfulness: and thou shalt know the Lord.' } },
    { word: 'Forgiving', lens: { ref: 'Hosea 14:4', text: 'I will heal their backsliding, I will love them freely.' } },
    { word: 'Kind', lens: { ref: 'Hosea 6:6', text: 'For I desired mercy, and not sacrifice.' } },
    { word: 'Patient', lens: { ref: 'Joel 2:13', text: 'He is gracious and merciful, slow to anger, and of great kindness.' } },
    { word: 'Honest', lens: { ref: 'Joel 2:13', text: 'And rend your heart, and not your garments.' } },
    { word: 'Stubborn', lens: { ref: 'Hosea 4:16', text: 'For Israel slideth back as a backsliding heifer.' } },
    { word: 'Hungry', lens: { ref: 'Joel 1:4', text: 'That which the palmerworm hath left hath the locust eaten.' } },
    { word: 'Generous', lens: { ref: 'Joel 2:28', text: 'I will pour out my spirit upon all flesh.' } },
    { word: 'Loud', lens: { ref: 'Joel 2:1', text: 'Blow ye the trumpet in Zion, and sound an alarm in my holy mountain.' } },
    { word: 'Relentless', lens: { ref: 'Joel 2:7', text: 'They shall run like mighty men; they shall climb the wall like men of war.' } },
    { word: 'Lost', lens: { ref: 'Hosea 6:1', text: 'Come, and let us return unto the Lord: for he hath torn, and he will heal us.' } },
    { word: 'Overrated' },
    { word: 'Underrated' },
    { word: 'Sketchy' },
    { word: 'Clutch' },
    { word: 'Awkward' },
    { word: 'Chaotic' },
    { word: 'Expensive' },
    { word: 'Annoying' },
    { word: 'Satisfying' },
    { word: 'Gross' },
    { word: 'Scary' },
    { word: 'Exhausting' },
    { word: 'Weird' },
    { word: 'Classic' },
    { word: 'Messy' },
    { word: 'Brave' },
    { word: 'Cozy' },
    { word: 'Dramatic' },
    { word: 'Slow' },
  ],
  reds: [
    // scripture
    'Hosea', 'Joel', 'A swarm of locusts', 'Jonah', 'Nephi', 'Captain Moroni', 'Daniel', 'Goliath', 'Noah\'s ark',
    'Moses', 'The Good Samaritan', 'Peter', 'The prodigal son', 'Samuel the Lamanite', 'Ammon', 'The stripling warriors',
    'Elijah', 'Queen Esther', 'The brother of Jared', 'Laman and Lemuel',
    // church
    'Seminary', 'Fast Sunday', 'The bishop', 'Funeral potatoes', 'Green Jell-O', 'Girls camp', 'Youth conference',
    'A mission call', 'General Conference', 'Sacrament meeting', 'A stake dance', 'The temple', 'The church parking lot',
    'This class', 'The ward Christmas party', 'A two-hour testimony meeting',
    // Thanksgiving
    'Thanksgiving dinner', 'Pumpkin pie', 'The turkey', 'Stuffing', 'Leftovers', 'Black Friday', 'Football on TV',
    'Cranberry sauce', 'Mashed potatoes', 'A food coma', 'Your uncle', 'The dishes afterward',
    // around here
    'Yellowstone', 'The Snake River', 'A moose', 'Grand Teton', 'Lava Hot Springs', 'Idaho potatoes', 'Deer season',
    'A corn maze', 'A snow day', 'Black ice', 'Costco', 'Walmart at midnight', 'Swig', 'Crumbl cookies', 'Dutch Bros',
    'Chick-fil-A', 'Taco Bell', 'BYU vs. Utah', 'Boise State', 'Track season', 'Pole vault',
    // life
    'Your little brother', 'The group chat', 'Your phone at 1%', 'A cracked phone screen', 'AirPods', 'Snapchat',
    'TikTok', 'YouTube', 'Minecraft', 'Fortnite', 'Roblox', 'Netflix', 'Spotify', 'Homework', 'A pop quiz',
    'PE class', 'The school bus', 'Driver\'s ed', 'A speeding ticket', 'Mom\'s minivan', 'A dad joke', 'A fire drill',
    'The dentist', 'A flat tire', 'A power outage', 'Monday morning', 'Summer break', 'A cold shower', 'Wet socks',
    'Duct tape', 'Hot Cheetos', 'A golden retriever', 'A trampoline', 'Your first car', 'Grandma',
    // famous
    'Taylor Swift', 'MrBeast', 'LeBron James', 'Lionel Messi', 'Batman', 'Shrek', 'SpongeBob', 'Darth Vader',
    'Harry Potter', 'Pikachu', 'Mario', 'The Super Bowl', 'A buzzer beater',
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
