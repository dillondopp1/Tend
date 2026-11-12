import { describe, expect, it } from 'vitest';
import { isTeacherPin, TEACHER_PIN_MAX } from './pin';

describe('isTeacherPin', () => {
  it('accepts 6 to 12 digits', () => {
    expect(isTeacherPin('123456')).toBe(true);
    expect(isTeacherPin('123456789012')).toBe(true);
    expect('123456789012'.length).toBe(TEACHER_PIN_MAX);
  });
  it('still accepts an existing 4-digit PIN', () => {
    expect(isTeacherPin('1234')).toBe(true);
  });
  it('rejects other lengths and non-digits', () => {
    for (const p of ['', '123', '12345', '1234567890123', '12a456', ' 123456']) expect(isTeacherPin(p)).toBe(false);
  });
});
