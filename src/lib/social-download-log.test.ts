import { describe, expect, it, beforeEach } from 'vitest';
import { clearSocialFailures, readSocialFailures, recordSocialFailure, socialFailureSummary } from './social-download-log';

describe('social failure log', () => {
  beforeEach(() => {
    clearSocialFailures();
  });

  it('records and limits failure history', () => {
    for (let i = 0; i < 505; i += 1) {
      recordSocialFailure({ url: `https://example.com/${i}`, message: 'network', attempt: 1, time: new Date().toISOString() });
    }
    expect(readSocialFailures()).toHaveLength(500);
  });

  it('summarizes failures by platform', () => {
    const entries = [
      { url: 'a', platform: 'TikTok', message: 'x', attempt: 1, time: 'now' },
      { url: 'b', platform: 'TikTok', message: 'y', attempt: 2, time: 'now' },
      { url: 'c', platform: 'Instagram', message: 'z', attempt: 1, time: 'now' },
    ];
    expect(socialFailureSummary(entries)).toEqual({ total: 3, byPlatform: { TikTok: 2, Instagram: 1 } });
  });
});
