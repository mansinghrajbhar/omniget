export type SocialFailure = {
  url: string;
  platform?: string;
  message: string;
  attempt: number;
  time: string;
};

export const SOCIAL_FAILURE_LOG_KEY = 'omniget.social.failures.v1';

// Keep an in-memory mirror so the persistence API also behaves consistently in
// Vitest/SSR environments where browser localStorage may be absent or mocked.
let memoryFailures: SocialFailure[] = [];

function storage(): Storage | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

function loadStoredFailures(): SocialFailure[] {
  const store = storage();
  if (!store) return [];
  try {
    const value = JSON.parse(store.getItem(SOCIAL_FAILURE_LOG_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function readSocialFailures(): SocialFailure[] {
  if (memoryFailures.length === 0) {
    memoryFailures = loadStoredFailures().slice(0, 500);
  }
  return [...memoryFailures];
}

export function recordSocialFailure(entry: SocialFailure): SocialFailure[] {
  const next = [entry, ...readSocialFailures()].slice(0, 500);
  memoryFailures = next;

  const store = storage();
  if (store) {
    try {
      store.setItem(SOCIAL_FAILURE_LOG_KEY, JSON.stringify(next));
    } catch {
      // localStorage may be unavailable/quota-limited; memory remains usable.
    }
  }

  return [...next];
}

export function clearSocialFailures(): void {
  memoryFailures = [];
  const store = storage();
  if (store) {
    try {
      store.removeItem(SOCIAL_FAILURE_LOG_KEY);
    } catch {
      // Ignore storage failures; the in-memory log is already cleared.
    }
  }
}

export function socialFailureSummary(entries: SocialFailure[]): { total: number; byPlatform: Record<string, number> } {
  const byPlatform: Record<string, number> = {};
  for (const entry of entries) {
    const key = entry.platform || 'Unknown';
    byPlatform[key] = (byPlatform[key] || 0) + 1;
  }
  return { total: entries.length, byPlatform };
}
