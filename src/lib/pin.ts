// Teacher PINs are 6-12 digits. Older 4-digit teacher PINs still sign in until they are replaced.
export const TEACHER_PIN_MAX = 12;
export const isTeacherPin = (pin: string) => /^(\d{4}|\d{6,12})$/.test(pin);
