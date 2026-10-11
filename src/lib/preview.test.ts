import { describe, it, expect } from 'vitest';
import { isPreviewHost } from './preview';

describe('isPreviewHost', () => {
  it('spots Netlify previews but not the live site', () => {
    expect(isPreviewHost('deploy-preview-3--ldstend.netlify.app')).toBe(true);
    expect(isPreviewHost('ldstend.netlify.app')).toBe(false);
    expect(isPreviewHost('localhost')).toBe(false);
  });
});
