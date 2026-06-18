/**
 * Retry helper for transient D1 read failures.
 *
 * Cloudflare D1 occasionally throws on otherwise-valid reads ("Failed query:
 * select ...") under load or transient infrastructure hiccups. For idempotent
 * reads (e.g. loading the agent row during token refresh) a short retry turns
 * those transient failures into successful responses instead of surfacing a
 * 500 to the client.
 *
 * Only use this for IDEMPOTENT operations (reads). Do not wrap writes that are
 * not safe to repeat.
 *
 * @module utils/db-retry
 */

export interface D1RetryOptions {
  /** Number of retries AFTER the first attempt (default: 2). */
  retries?: number;
  /** Base backoff in ms; grows linearly per attempt (default: 50). */
  delayMs?: number;
  /** Injectable sleep, primarily for tests. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function withD1Retry<T>(
  operation: () => Promise<T>,
  options: D1RetryOptions = {}
): Promise<T> {
  const retries = options.retries ?? 2;
  const delayMs = options.delayMs ?? 50;
  const sleep = options.sleep ?? defaultSleep;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(delayMs * (attempt + 1));
      }
    }
  }

  throw lastError;
}
