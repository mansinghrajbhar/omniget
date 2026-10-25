export type SocialFailure = {
  url: string;
  platform?: string;
  message: string;
  attempt: number;
  time: string;
};

export const SOCIAL_FAILURE_LOG_KEY = 'omniget.social.failures.v1';

// Vitest runs in a Node environment without browser localStorage. Keep a small
// in-memory fallback so the same persistence API is testable outside the app.
let memoryFailures: SocialFailure[] = [];

function storage(): Storage | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

export function readSocialFailures(): SocialFailure[] {
  const store = storage();
  if (!store) return [...memoryFailures];
  try {
    const value = JSON.parse(store.getItem(SOCIAL_FAILURE_LOG_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function recordSocialFailure(entry: SocialFailure): SocialFailure[] {
  const next = [entry, ...readSocialFailures()].slice(0, 500);
  const store = storage();
  if (store) store.setItem(SOCIAL_FAILURE_LOG_KEY, JSON.stringify(next));
  else memoryFailures = next;
  return next;
}

export function clearSocialFailures(): void {
  const store = storage();
  if (store) store.removeItem(SOCIAL_FAILURE_LOG_KEY);
  memoryFailures = [];
}

export function socialFailureSummary(entries: SocialFailure[]): { total: number; byPlatform: Record<string, number> } {
  const byPlatform: Record<string, number> = {};
  for (const entry of entries) {
    const key = entry.platform || 'Unknown';
    byPlatform[key] = (byPlatform[key] || 0) + 1;
  }
  return { total: entries.length, byPlatform };
}
