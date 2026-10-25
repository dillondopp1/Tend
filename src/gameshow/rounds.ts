export interface Round {
  id: number;
  title: string;
  setup: string;
  ask: string;
  vote: string; // what to vote for
  lens?: { ref: string; text: string };
}

export const ROUNDS: Round[] = [
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
];

export const MAX_ANSWER = 140;
export const WRITE_SECS = 100;
export const VOTE_SECS = 45;
/** The show is a one-night feature; the Home button only appears on this local date. */
export const SHOW_DATE = '2026-10-25';
