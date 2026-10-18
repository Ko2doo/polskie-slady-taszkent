import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRateLimiter } from '@/utils/rateLimiter';

let limiter;

beforeEach(() => {
  vi.useFakeTimers();
  limiter = createRateLimiter({ windowMs: 1000, maxPerWindow: 3 });
});

afterEach(() => vi.useRealTimers());

const hits = (key, times) => Array.from({ length: times }, () => limiter.isLimited(key));

describe('createRateLimiter', () => {
  it('lets the first maxPerWindow hits of a key through, limits the next ones', () => {
    expect(hits('a', 5)).toEqual([false, false, false, true, true]);
  });

  it('counts each key on its own', () => {
    hits('a', 3);

    expect(limiter.isLimited('b')).toBe(false);
    expect(limiter.isLimited('a')).toBe(true);
  });

  it('the window is counted from the first hit: at its last moment still limited', () => {
    hits('a', 3);
    vi.advanceTimersByTime(1000);

    expect(limiter.isLimited('a')).toBe(true);
  });

  it('once the window has passed, the key starts over', () => {
    hits('a', 4);
    vi.advanceTimersByTime(1001);

    expect(hits('a', 4)).toEqual([false, false, false, true]);
  });

  it('reset forgets every key', () => {
    hits('a', 3);
    hits('b', 3);
    limiter.reset();

    expect(limiter.isLimited('a')).toBe(false);
    expect(limiter.isLimited('b')).toBe(false);
  });

  it('an expired key is dropped even when only other keys are checked', () => {
    hits('a', 3);
    vi.advanceTimersByTime(1001);
    limiter.isLimited('b'); // drops 'a'

    expect(hits('a', 3)).toEqual([false, false, false]);
  });
});
