export type InstallPlatform = 'installed' | 'ios-safari' | 'ios-other' | 'in-app' | 'android' | 'other';

export function detectPlatform(ua: string, standalone: boolean, maxTouchPoints = 0): InstallPlatform {
  if (standalone) return 'installed';
  if (/Instagram|FBAN|FBAV|Snapchat|TikTok|musical_ly|Line\/|Twitter/i.test(ua)) return 'in-app';
  const iOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
  if (iOS) return /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua) ? 'ios-other' : 'ios-safari';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

export function currentPlatform(): InstallPlatform {
  const standalone = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return detectPlatform(navigator.userAgent, standalone, navigator.maxTouchPoints);
}
