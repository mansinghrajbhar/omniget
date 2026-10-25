export type SocialRetryPolicy = {
  enabled: boolean;
  attempts?: number;
  backoffMs?: number;
};

export const DEFAULT_SOCIAL_RETRY_ATTEMPTS = 3;
export const DEFAULT_SOCIAL_RETRY_BACKOFF_MS = 1200;

/** Normalize a user-pasted URL so duplicate detection is stable without changing its path. */
export function normalizeSocialUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    parsed.hash = '';
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    // Tracking parameters do not identify a different public post.
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|igshid$)/i.test(key)) parsed.searchParams.delete(key);
    }
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return trimmed;
  }
}

export function dedupeSocialUrls(values: string[]): { urls: string[]; duplicates: string[] } {
  const seen = new Set<string>();
  const urls: string[] = [];
  const duplicates: string[] = [];
  for (const value of values) {
    const normalized = normalizeSocialUrl(value);
    if (!normalized) continue;
    if (seen.has(normalized)) {
      duplicates.push(value.trim());
      continue;
    }
    seen.add(normalized);
    urls.push(value.trim());
  }
  return { urls, duplicates };
}

export function validateSocialDateRange(fromDate: string, toDate: string): string | null {
  if (!fromDate || !toDate) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
    return 'Dates must use YYYY-MM-DD format.';
  }
  return fromDate > toDate ? 'The From date must be before the To date.' : null;
}

export function socialRetryAttempts(policy: SocialRetryPolicy): number {
  if (!policy.enabled) return 1;
  const requested = Math.floor(policy.attempts ?? DEFAULT_SOCIAL_RETRY_ATTEMPTS);
  return Math.min(5, Math.max(1, requested));
}

export function socialRetryDelay(policy: SocialRetryPolicy, retryNumber: number): number {
  const base = Math.max(0, policy.backoffMs ?? DEFAULT_SOCIAL_RETRY_BACKOFF_MS);
  return Math.min(30_000, base * Math.max(1, retryNumber));
}

export function isRetryableSocialError(error: unknown): boolean {
  const message = String(error instanceof Error ? error.message : error ?? '').toLowerCase();
  if (!message) return true;
  return !/(cancelled|canceled|unsupported|private|login required|access denied|captcha|drm)/i.test(message);
}

export async function withSocialRetry<T>(
  operation: () => Promise<T>,
  policy: SocialRetryPolicy = { enabled: true },
): Promise<T> {
  const attempts = socialRetryAttempts(policy);
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isRetryableSocialError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, socialRetryDelay(policy, attempt)));
    }
  }
  throw lastError;
}
