export interface Round {
  id: number;
  title: string;
  setup: string;
  ask: string;
  vote: string; // what to vote for
  lens?: { ref: string; text: string };
  /** Lighter bonus rounds after the main set: no verse, vote for the funniest. */
  fun?: boolean;
}

/** Jeremiah show, CFM week 43 (2026-10-25). Final: leave as is. */
export const JEREMIAH: Round[] = [
  { id: 1, title: 'Left out', setup: 'You see the story. Everyone from your group is at someone\'s house, and nobody told you.',
    ask: 'What\'s the first thing you actually think?', vote: 'Vote for the most honest one.',
    lens: { ref: 'Jeremiah 1:5', text: 'Before I formed thee in the belly I knew thee; and before thou camest forth out of the womb I sanctified thee.' } },
  { id: 2, title: 'The cover story', setup: 'You told your parents you were at a friend\'s house. You weren\'t. It\'s been three days and they haven\'t asked again.',
    ask: 'What do you tell yourself about why it\'s fine to just leave it?', vote: 'Vote for the most honest one.',
    lens: { ref: 'Jeremiah 3:22', text: 'Return, ye backsliding children, and I will heal your backslidings.' } },
  { id: 3, title: 'The invite', setup: 'A friend texts: "u coming friday? their parents are out. everyone\'s gonna be there." You know what that means.',
    ask: 'Type the exact text you send back.', vote: 'Vote for the one you\'d steal.',
    lens: { ref: 'Jeremiah 1:5', text: 'I sanctified thee, and I ordained thee a prophet unto the nations.' } },
  { id: 4, title: 'The promise', setup: 'A friend says "promise you won\'t tell anyone," then tells you something that really worries you about them.',
    ask: 'What goes through your head before you answer?', vote: 'Vote for the most honest one.',
    lens: { ref: 'Jeremiah 1:8', text: 'Be not afraid of their faces: for I am with thee to deliver thee, saith the Lord.' } },
  { id: 5, title: 'The real question', setup: 'A friend you respect asks, not as a joke: "Do you actually believe all that, or is it just because your parents do?"',
    ask: 'Type your honest answer.', vote: 'Vote for the one you\'d steal.',
    lens: { ref: 'Jeremiah 20:9', text: 'His word was in mine heart as a burning fire shut up in my bones.' } },
  { id: 6, title: 'The empty seat', setup: 'A new kid has sat alone at the end of the table for three days. Your table is full, and nobody\'s being mean.',
    ask: 'What do you honestly say to yourself before you decide?', vote: 'Vote for the most honest one.',
    lens: { ref: 'Jeremiah 16:16', text: 'Behold, I will send for many fishers, saith the Lord, and they shall fish them.' } },
  { id: 7, title: '1 a.m.', setup: 'You\'ve been on your phone for two hours and you feel worse than when you started.',
    ask: 'Type the lie you tell yourself to keep going.', vote: 'Vote for the most honest one.',
    lens: { ref: 'Jeremiah 2:13', text: 'They have forsaken me the fountain of living waters, and hewed them out cisterns, broken cisterns, that can hold no water.' } },
  { id: 8, title: 'The fun one', setup: 'Your family group chat is still called "Family 🙂".',
    ask: 'Type the name it would have if it told the truth.', vote: 'Vote for the funniest one.' },
  { id: 9, fun: true, title: 'Your pet talks', setup: 'Your Tend pet gets to talk for exactly one day, and it has been watching you closely.',
    ask: 'Type what it says about you.', vote: 'Vote for the funniest one.' },
  { id: 10, fun: true, title: 'Sunday, 8:40 a.m.', setup: 'You leave for church in five minutes, and the whole house is in chaos.',
    ask: 'Type the sentence somebody yells.', vote: 'Vote for the funniest one.' },
  { id: 11, fun: true, title: 'The potluck movie', setup: 'A big-budget movie gets made about the most chaotic ward potluck of all time.',
    ask: 'Type the movie title.', vote: 'Vote for the funniest one.' },
  { id: 12, fun: true, title: 'The opening line', setup: 'You have five minutes to give a talk in sacrament meeting, and you want a dramatic start.',
    ask: 'Type the first sentence.', vote: 'Vote for the funniest one.' },
  { id: 13, fun: true, title: 'Fast ends', setup: 'Fast Sunday is finally over, the clock just hit the minute, and you have not eaten in a long time.',
    ask: 'Type the first thing you eat.', vote: 'Vote for the funniest one.' },
  { id: 14, fun: true, title: 'One new rule', setup: 'You get to add exactly one new rule to Sundays, and everyone has to follow it.',
    ask: 'Type the rule.', vote: 'Vote for the funniest one.' },
];

/** Ezekiel show, CFM week 45: "A New Spirit Will I Put within You" (Ezekiel 1-3; 33-34; 36-37; 47). */
export const EZEKIEL: Round[] = [
  { id: 1, title: 'The stony heart', setup: 'Your best friend told people the thing you told them in confidence: your parents are getting divorced. A week later they catch you after third period and say, "I\'m so sorry, I don\'t know why I did that."',
    ask: 'Type what you actually say back.', vote: 'Vote for the most honest one.',
    lens: { ref: 'Ezekiel 36:26', text: 'A new heart also will I give you, and a new spirit will I put within you: and I will take away the stony heart out of your flesh.' } },
  { id: 2, title: 'Fourth time', setup: 'You swore you\'d stop copying homework from the group chat. It\'s ten minutes before first period and you\'re doing it again, the fourth time this month.',
    ask: 'Type what you tell yourself while you copy it.', vote: 'Vote for the most honest one.',
    lens: { ref: 'Ezekiel 33:16', text: 'None of his sins that he hath committed shall be mentioned unto him.' } },
  { id: 3, title: 'Dry bones', setup: 'You used to read your scriptures every night. Then the season started, you stopped, and it\'s been three months. They\'re under a pile of laundry on your floor.',
    ask: 'Type the honest reason you haven\'t picked them back up.', vote: 'Vote for the most honest one.',
    lens: { ref: 'Ezekiel 37:5', text: 'Behold, I will cause breath to enter into you, and ye shall live.' } },
  { id: 4, title: 'The watchman', setup: 'Your friend screenshots an awkward message a kid sent to the group chat and is about to post it on their story with a laughing caption. They show you first: "this is going up."',
    ask: 'Type exactly what you say before they post it.', vote: 'Vote for the one you\'d steal.',
    lens: { ref: 'Ezekiel 3:17', text: 'Son of man, I have made thee a watchman unto the house of Israel.' } },
  { id: 5, title: 'The lost sheep', setup: 'A kid who was in your Sunday class last year stopped coming after their parents split up. You see them at the store at 9 p.m., and they see you.',
    ask: 'Type the first thing you say.', vote: 'Vote for the one you\'d steal.',
    lens: { ref: 'Ezekiel 34:16', text: 'I will seek that which was lost, and bring again that which was driven away, and will bind up that which was broken.' } },
  { id: 6, title: 'Two sticks', setup: 'In history class the topic turns to religion, and a friend from another church asks in front of everyone: "Why do you guys need the Book of Mormon if you already have the Bible?"',
    ask: 'Type the answer you\'d actually give right then.', vote: 'Vote for the one you\'d steal.',
    lens: { ref: 'Ezekiel 37:17', text: 'And join them one to another into one stick; and they shall become one in thine hand.' } },
  { id: 7, title: 'The river', setup: 'It\'s the youth temple trip, Saturday at 7 a.m. You failed a test Friday, fought with your mom on the drive, and now you\'re sitting in the waiting room in white, feeling nothing.',
    ask: 'Type what you\'re honestly thinking right then.', vote: 'Vote for the most honest one.',
    lens: { ref: 'Ezekiel 47:9', text: 'And every thing shall live whither the river cometh.' } },
  { id: 8, title: 'Feed my sheep', setup: 'You and your companion minister to an older widow in the ward. Your companion bailed for the second month in a row, and she just texted asking if someone could help rake her leaves Saturday.',
    ask: 'Type the text you send her back.', vote: 'Vote for the one you\'d steal.',
    lens: { ref: 'Ezekiel 34:15', text: 'I will feed my flock, and I will cause them to lie down, saith the Lord God.' } },
  { id: 9, fun: true, title: 'Skeleton talk', setup: 'A whole valley of dry bones just came back to life.',
    ask: 'Type the first thing one of the skeletons says.', vote: 'Vote for the funniest one.' },
  { id: 10, fun: true, title: 'Eat the scroll', setup: 'Ezekiel ate a scroll and it tasted as sweet as honey.',
    ask: 'Type which book of scripture you\'d eat, and what flavor it is.', vote: 'Vote for the funniest one.' },
  { id: 11, fun: true, title: 'Night shift', setup: 'You\'re the watchman on the city wall all night, and nothing is happening.',
    ask: 'Type the most boring warning you shout.', vote: 'Vote for the funniest one.' },
  { id: 12, fun: true, title: 'Two sticks', setup: 'Ezekiel joined two sticks into one.',
    ask: 'Type a brand-new invention made from two sticks.', vote: 'Vote for the funniest one.' },
  { id: 13, fun: true, title: 'Fish complaint', setup: 'A river flows out of the temple, and suddenly the Dead Sea is full of fish.',
    ask: 'Type the first complaint from one of the fish.', vote: 'Vote for the funniest one.' },
  { id: 14, fun: true, title: 'The wheels', setup: 'Ezekiel saw wheels inside of wheels.',
    ask: 'Type the name of the theme park ride.', vote: 'Vote for the funniest one.' },
];

export interface ShowDef { id: string; date: string; title: string; clips: string; rounds: Round[] }
/** One show per class night. `clips` is the folder under public/gameshow for its round clips. */
export const SHOWS: ShowDef[] = [
  { id: 'jeremiah', date: '2026-10-25', title: 'Jeremiah', clips: '', rounds: JEREMIAH },
  { id: 'ezekiel', date: '2026-11-08', title: 'Ezekiel', clips: 'ezekiel/', rounds: EZEKIEL },
];
const localToday = () => new Date().toLocaleDateString('en-CA');
/** Today's show, or the most recent one before today. */
export function todaysShow(today = localToday()): ShowDef {
  const past = SHOWS.filter((x) => x.date <= today).sort((a, b) => (a.date < b.date ? 1 : -1));
  return past[0] ?? SHOWS[SHOWS.length - 1];
}
export const showFor = (id?: string): ShowDef => SHOWS.find((x) => x.id === id) ?? todaysShow();
/** The Home button only appears on a show's own date. */
export const isShowDay = (today = localToday()) => SHOWS.some((x) => x.date === today);

export const MAX_ANSWER = 140;
export const WRITE_SECS = 100;
export const VOTE_SECS = 45;
