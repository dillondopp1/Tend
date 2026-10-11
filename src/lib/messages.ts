import type { FnError } from './functions';

const TEXT: Record<FnError, string> = {
  bad_code: "Hmm, that class code didn't work. Double-check it with your teacher!",
  name_taken: 'Someone in your class already has that name. Try adding your last initial!',
  bad_name: 'Pick a name with 1 to 24 letters.',
  bad_pin: 'Your PIN needs to be exactly 4 numbers.',
  bad_login: "That didn't match. Check your class code, name and PIN.",
  locked: 'Too many tries. Take a 15-minute break, or ask your teacher to reset your PIN.',
  forbidden: "You don't have access to that.",
  unauthorized: 'Please sign in again.',
  server: 'Something went wrong on our end. Try again in a moment.',
  network: "Can't reach Tend right now. Check your internet and try again.",
};

export const errorText = (e: FnError) => TEXT[e];
