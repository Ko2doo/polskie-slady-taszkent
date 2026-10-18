/**
 * Rate limiter: at most `maxPerWindow` hits of the same key per `windowMs`, counted from the key's
 * first hit in the window. Plain closure state, no reactivity — bookkeeping that must not wake up
 * anything rendered (harness/performance.md → "Reactivity"). Keys whose window has passed are
 * dropped on every check, so the bookkeeping never outgrows the keys seen within one window.
 */

/**
 * Create a rate limiter.
 *
 * @param {Object} options - Limits
 * @param {number} options.windowMs - length of the counting window, in milliseconds
 * @param {number} options.maxPerWindow - hits of one key allowed within a window
 * @returns {{ isLimited: (key: string) => boolean, reset: () => void }} `isLimited` counts a hit
 *   and says whether it is over the limit; `reset` forgets every key
 *
 * @example
 * const limiter = createRateLimiter({ windowMs: 1000, maxPerWindow: 3 });
 * if (limiter.isLimited(`${kind}:${text}`)) return; // the 4th same message within a second
 */
export function createRateLimiter({ windowMs, maxPerWindow }) {
  // key → { count, firstSeen }
  let recentHits = new Map();

  function dropExpired(now) {
    for (const [key, hit] of recentHits) {
      if (now - hit.firstSeen > windowMs) recentHits.delete(key);
    }
  }

  function isLimited(key) {
    const now = Date.now();
    dropExpired(now);

    const hit = recentHits.get(key);
    if (!hit) {
      recentHits.set(key, { count: 1, firstSeen: now });
      return false;
    }

    hit.count++;
    return hit.count > maxPerWindow;
  }

  function reset() {
    recentHits = new Map();
  }

  return { isLimited, reset };
}
