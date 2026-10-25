export type SocialFailure = {
  url: string;
  platform?: string;
  message: string;
  attempt: number;
  time: string;
};

export const SOCIAL_FAILURE_LOG_KEY = 'omniget.social.failures.v1';

export function readSocialFailures(): SocialFailure[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const value = JSON.parse(localStorage.getItem(SOCIAL_FAILURE_LOG_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function recordSocialFailure(entry: SocialFailure): SocialFailure[] {
  const next = [entry, ...readSocialFailures()].slice(0, 500);
  if (typeof localStorage !== 'undefined') localStorage.setItem(SOCIAL_FAILURE_LOG_KEY, JSON.stringify(next));
  return next;
}

export function clearSocialFailures(): void {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(SOCIAL_FAILURE_LOG_KEY);
}

export function socialFailureSummary(entries: SocialFailure[]): { total: number; byPlatform: Record<string, number> } {
  const byPlatform: Record<string, number> = {};
  for (const entry of entries) {
    const key = entry.platform || 'Unknown';
    byPlatform[key] = (byPlatform[key] || 0) + 1;
  }
  return { total: entries.length, byPlatform };
}
