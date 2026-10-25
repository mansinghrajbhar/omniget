import { describe, expect, it, vi } from 'vitest';
import {
  dedupeSocialUrls,
  isRetryableSocialError,
  normalizeSocialUrl,
  socialRetryAttempts,
  socialRetryDelay,
  validateSocialDateRange,
  withSocialRetry,
} from './social-downloader';

describe('social downloader helpers', () => {
  it('normalizes tracking parameters and host casing', () => {
    expect(normalizeSocialUrl('https://WWW.TikTok.com/@Demo/?utm_source=x#video')).toBe('https://tiktok.com/@Demo');
  });

  it('removes duplicate URLs while preserving the first pasted value', () => {
    const result = dedupeSocialUrls([
      'https://instagram.com/user/p/1?utm_source=a',
      'https://instagram.com/user/p/1?utm_source=b',
      'https://tiktok.com/@demo',
    ]);
    expect(result.urls).toEqual(['https://instagram.com/user/p/1?utm_source=a', 'https://tiktok.com/@demo']);
    expect(result.duplicates).toHaveLength(1);
  });

  it('validates date ranges', () => {
    expect(validateSocialDateRange('2026-10-01', '2026-10-26')).toBeNull();
    expect(validateSocialDateRange('2026-10-27', '2026-10-26')).toContain('From date');
    expect(validateSocialDateRange('bad', '2026-10-26')).toContain('YYYY-MM-DD');
  });

  it('caps retry attempts and uses bounded backoff', () => {
    expect(socialRetryAttempts({ enabled: false, attempts: 5 })).toBe(1);
    expect(socialRetryAttempts({ enabled: true, attempts: 99 })).toBe(5);
    expect(socialRetryDelay({ enabled: true, backoffMs: 1200 }, 2)).toBe(2400);
    expect(socialRetryDelay({ enabled: true, backoffMs: 99_999 }, 5)).toBe(30_000);
  });

  it('does not retry access-control failures', () => {
    expect(isRetryableSocialError(new Error('CAPTCHA required'))).toBe(false);
    expect(isRetryableSocialError(new Error('temporary network error'))).toBe(true);
  });

  it('retries transient failures and returns the eventual result', async () => {
    vi.useFakeTimers();
    let calls = 0;
    const promise = withSocialRetry(
      async () => {
        calls += 1;
        if (calls < 3) throw new Error('temporary network error');
        return 'ok';
      },
      { enabled: true, attempts: 3, backoffMs: 1 },
    );
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe('ok');
    expect(calls).toBe(3);
    vi.useRealTimers();
  });
});
