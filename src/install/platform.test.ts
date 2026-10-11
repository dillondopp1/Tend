import { describe, it, expect } from 'vitest';
import { detectPlatform } from './platform';

const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1';
const IPHONE_INSTA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0';
const IPAD_DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

describe('detectPlatform', () => {
  it('installed wins', () => expect(detectPlatform(IPHONE_SAFARI, true)).toBe('installed'));
  it('iPhone Safari', () => expect(detectPlatform(IPHONE_SAFARI, false)).toBe('ios-safari'));
  it('iPhone Chrome', () => expect(detectPlatform(IPHONE_CHROME, false)).toBe('ios-other'));
  it('in-app browser', () => expect(detectPlatform(IPHONE_INSTA, false)).toBe('in-app'));
  it('iPad with desktop UA', () => expect(detectPlatform(IPAD_DESKTOP_UA, false, 5)).toBe('ios-safari'));
  it('Mac desktop is not iOS', () => expect(detectPlatform(IPAD_DESKTOP_UA, false, 0)).toBe('other'));
  it('Android', () => expect(detectPlatform(ANDROID, false)).toBe('android'));
  it('desktop', () => expect(detectPlatform(DESKTOP, false)).toBe('other'));
});
