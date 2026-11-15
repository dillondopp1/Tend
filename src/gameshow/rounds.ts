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
  { id: 2, fun: true, title: 'Skeleton talk', setup: 'A whole valley of dry bones just came back to life.',
    ask: 'Type the first thing one of the skeletons says.', vote: 'Vote for the funniest one.' },
  { id: 3, title: 'Fourth time', setup: 'You swore you\'d stop copying homework from the group chat. It\'s ten minutes before first period and you\'re doing it again, the fourth time this month.',
    ask: 'Type what you tell yourself while you copy it.', vote: 'Vote for the most honest one.',
    lens: { ref: 'Ezekiel 33:16', text: 'None of his sins that he hath committed shall be mentioned unto him.' } },
  { id: 4, fun: true, title: 'Eat the scroll', setup: 'Ezekiel ate a scroll and it tasted as sweet as honey.',
    ask: 'Type which book of scripture you\'d eat, and what flavor it is.', vote: 'Vote for the funniest one.' },
  { id: 5, title: 'Dry bones', setup: 'You used to read your scriptures every night. Then the season started, you stopped, and it\'s been three months. They\'re under a pile of laundry on your floor.',
    ask: 'Type the honest reason you haven\'t picked them back up.', vote: 'Vote for the most honest one.',
    lens: { ref: 'Ezekiel 37:5', text: 'Behold, I will cause breath to enter into you, and ye shall live.' } },
  { id: 6, fun: true, title: 'Night shift', setup: 'You\'re the watchman on the city wall all night, and nothing is happening.',
    ask: 'Type the most boring warning you shout.', vote: 'Vote for the funniest one.' },
  { id: 7, title: 'The watchman', setup: 'Your friend screenshots an awkward message a kid sent to the group chat and is about to post it on their story with a laughing caption. They show you first: "this is going up."',
    ask: 'Type exactly what you say before they post it.', vote: 'Vote for the one you\'d steal.',
    lens: { ref: 'Ezekiel 3:17', text: 'Son of man, I have made thee a watchman unto the house of Israel.' } },
  { id: 8, fun: true, title: 'Stick invention', setup: 'Ezekiel joined two sticks into one.',
    ask: 'Type a brand-new invention made from two sticks.', vote: 'Vote for the funniest one.' },
  { id: 9, title: 'The lost sheep', setup: 'A kid who was in your Sunday class last year stopped coming after their parents split up. You see them at the store at 9 p.m., and they see you.',
    ask: 'Type the first thing you say.', vote: 'Vote for the one you\'d steal.',
    lens: { ref: 'Ezekiel 34:16', text: 'I will seek that which was lost, and bring again that which was driven away, and will bind up that which was broken.' } },
  { id: 10, fun: true, title: 'Fish complaint', setup: 'A river flows out of the temple, and suddenly the Dead Sea is full of fish.',
    ask: 'Type the first complaint from one of the fish.', vote: 'Vote for the funniest one.' },
  { id: 11, title: 'Two sticks', setup: 'In history class the topic turns to religion, and a friend from another church asks in front of everyone: "Why do you guys need the Book of Mormon if you already have the Bible?"',
    ask: 'Type the answer you\'d actually give right then.', vote: 'Vote for the one you\'d steal.',
    lens: { ref: 'Ezekiel 37:17', text: 'And join them one to another into one stick; and they shall become one in thine hand.' } },
  { id: 12, fun: true, title: 'The wheels', setup: 'Ezekiel saw wheels inside of wheels.',
    ask: 'Type the name of the theme park ride.', vote: 'Vote for the funniest one.' },
  { id: 13, title: 'The river', setup: 'It\'s the youth temple trip, Saturday at 7 a.m. You failed a test Friday, fought with your mom on the drive, and now you\'re sitting in the waiting room in white, feeling nothing.',
    ask: 'Type what you\'re honestly thinking right then.', vote: 'Vote for the most honest one.',
    lens: { ref: 'Ezekiel 47:9', text: 'And every thing shall live whither the river cometh.' } },
  { id: 14, fun: true, title: 'The fine print', setup: 'You get a brand-new heart, just like Ezekiel promised, and it comes with a warranty.',
    ask: 'Type one line of the fine print.', vote: 'Vote for the funniest one.' },
  { id: 15, title: 'Feed my sheep', setup: 'You and your companion minister to an older widow in the ward. Your companion bailed for the second month in a row, and she just texted asking if someone could help rake her leaves Saturday.',
    ask: 'Type the text you send her back.', vote: 'Vote for the one you\'d steal.',
    lens: { ref: 'Ezekiel 34:15', text: 'I will feed my flock, and I will cause them to lie down, saith the Lord God.' } },
  { id: 16, fun: true, title: 'Dead Sea resort', setup: 'The Dead Sea is healed, and someone just opened a beach resort there.',
    ask: 'Type the slogan for the resort.', vote: 'Vote for the funniest one.' },
];

/** Daniel show, CFM week 46: "There Is No Other God That Can Deliver" (Daniel 1-7). Serious and fun alternate. */
export const DANIEL: Round[] = [
  { id: 1, title: 'The table', setup: 'After the big win, the whole team goes to a teammate\'s house. Someone passes around a vape and says, "one hit, nobody\'s telling your parents." Everyone is watching you.',
    ask: 'Type what you say.', vote: 'Vote for the one you\'d steal.',
    lens: { ref: 'Daniel 1:8', text: 'But Daniel purposed in his heart that he would not defile himself with the portion of the king\'s meat, nor with the wine which he drank.' } },
  { id: 2, fun: true, title: 'Ten days of veggies', setup: 'Daniel and his friends ate only vegetables for ten days and came out healthier than everyone else.',
    ask: 'Type the title of the diet book they write.', vote: 'Vote for the funniest one.' },
  { id: 3, title: 'The big decision', setup: 'You have until Friday to decide: stay on the team you\'ve played on for years, or switch schools for a better program. You keep telling people you\'re praying about it. You haven\'t actually prayed once.',
    ask: 'Type the honest reason you haven\'t.', vote: 'Vote for the most honest one.',
    lens: { ref: 'Daniel 2:18', text: 'That they would desire mercies of the God of heaven concerning this secret.' } },
  { id: 4, fun: true, title: 'The king\'s demand', setup: 'The king forgot his dream and ordered the wise men to tell him the dream AND what it means.',
    ask: 'Type the next unreasonable demand the king makes.', vote: 'Vote for the funniest one.' },
  { id: 5, title: 'Everyone bows', setup: 'The group chat is roasting a kid in your grade with a mean edited photo. Fifteen people have reacted with laughing faces. Then someone texts: "why are you the only one not reacting, relax."',
    ask: 'Type what you send back.', vote: 'Vote for the one you\'d steal.',
    lens: { ref: 'Daniel 3:17', text: 'Our God whom we serve is able to deliver us from the burning fiery furnace.' } },
  { id: 6, fun: true, title: 'Band practice', setup: 'Whenever the band played, everyone had to bow to a ninety-foot gold statue.',
    ask: 'Type the name of the song the band plays.', vote: 'Vote for the funniest one.' },
  { id: 7, title: 'But if not', setup: 'You said no in the group chat, and nothing magic happened. The next week you\'re eating lunch alone while the group laughs at a table across the room. Nobody is coming to get you.',
    ask: 'Type what you tell yourself while you eat.', vote: 'Vote for the most honest one.',
    lens: { ref: 'Daniel 3:18', text: 'But if not, be it known unto thee, O king, that we will not serve thy gods, nor worship the golden image which thou hast set up.' } },
  { id: 8, fun: true, title: 'The thermostat', setup: 'The king ordered the furnace heated seven times hotter than usual.',
    ask: 'Type the note taped to the furnace thermostat.', vote: 'Vote for the funniest one.' },
  { id: 9, title: 'The only one', setup: 'You\'re the only member of your church in your grade. A new kid at lunch asks, "what do you do on Sundays, are you in some weird church?" The whole table goes quiet to hear your answer.',
    ask: 'Type your answer in one sentence.', vote: 'Vote for the one you\'d steal.',
    lens: { ref: 'Daniel 2:35', text: 'And the stone that smote the image became a great mountain, and filled the whole earth.' } },
  { id: 10, fun: true, title: 'Grass diet', setup: 'The king spent seven years eating grass like an ox.',
    ask: 'Type his review of the grass.', vote: 'Vote for the funniest one.' },
  { id: 11, title: 'The answer key', setup: 'The sub steps into the hallway in the middle of your test, and the answer key is open on the desk three feet from you. No cameras, and nobody is looking.',
    ask: 'Type what you tell yourself right then.', vote: 'Vote for the most honest one.',
    lens: { ref: 'Daniel 6:4', text: 'They could find none occasion nor fault; forasmuch as he was faithful.' } },
  { id: 12, fun: true, title: 'The hand', setup: 'During the king\'s big party, a hand appears out of nowhere and starts writing on the wall.',
    ask: 'Type what the hand writes.', vote: 'Vote for the funniest one.' },
  { id: 13, title: 'The window', setup: 'It\'s an away meet and you\'re sharing a hotel room with three teammates. You always pray before bed. They\'re watching a movie and joking loudly, and the lights are about to go out.',
    ask: 'Type what you do and what you say if someone asks.', vote: 'Vote for the one you\'d steal.',
    lens: { ref: 'Daniel 6:10', text: 'He kneeled upon his knees three times a day, and prayed, and gave thanks before his God, as he did aforetime.' } },
  { id: 14, fun: true, title: 'Lion review', setup: 'Daniel spent the night in a den of lions and nothing happened.',
    ask: 'Type the lions\' one-star review of the night.', vote: 'Vote for the funniest one.' },
  { id: 15, title: 'Just some guy', setup: 'In history class a kid says, loud enough for everyone, "Jesus was just some guy who got himself killed." The teacher looks around the room, and then at you.',
    ask: 'Type what you say.', vote: 'Vote for the one you\'d steal.',
    lens: { ref: 'Daniel 7:14', text: 'And there was given him dominion, and glory, and a kingdom, that all people, nations, and languages, should serve him.' } },
  { id: 16, fun: true, title: 'Beast number five', setup: 'Daniel dreamed of four strange beasts.',
    ask: 'Type the name of a fifth beast and one weird feature.', vote: 'Vote for the funniest one.' },
];

export interface ShowDef {
  id: string; date: string; title: string; clips: string; rounds: Round[];
  /** Fun rounds come as one block at the end, announced with the 'fun' clip (otherwise they alternate). */
  funBlock?: boolean;
}
/** One show per class night. `clips` is the folder under public/gameshow for its round clips. */
export const SHOWS: ShowDef[] = [
  { id: 'jeremiah', date: '2026-10-25', title: 'Jeremiah', clips: '', rounds: JEREMIAH, funBlock: true },
  { id: 'ezekiel', date: '2026-11-08', title: 'Ezekiel', clips: 'ezekiel/', rounds: EZEKIEL },
  { id: 'daniel', date: '2026-11-15', title: 'Daniel', clips: 'daniel/', rounds: DANIEL },
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
