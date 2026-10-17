import { describe, it, expect } from 'vitest';
import { getRawPathFromRoute, resolvePageKeyFromRouteResult } from '@/utils/routerUtils';

describe('getRawPathFromRoute', () => {
  it('returns a string path as is', () => {
    expect(getRawPathFromRoute({ path: '/handbook' })).toBe('/handbook');
  });

  it('prefers after, then original, then before for an object path', () => {
    expect(getRawPathFromRoute({ path: { before: '/b', original: '/o', after: '/a' } })).toBe('/a');
    expect(getRawPathFromRoute({ path: { before: '/b', original: '/o' } })).toBe('/o');
    expect(getRawPathFromRoute({ path: { before: '/b' } })).toBe('/b');
  });

  it('returns an empty string for a result without a usable path', () => {
    expect(getRawPathFromRoute({})).toBe('');
    expect(getRawPathFromRoute({ path: {} })).toBe('');
    expect(getRawPathFromRoute({ path: { after: 42 } })).toBe('');
  });

  // Every screen calls this with `route?.result`, which can be undefined
  it('returns an empty string for a missing result', () => {
    expect(getRawPathFromRoute(undefined)).toBe('');
    expect(getRawPathFromRoute(null)).toBe('');
  });
});

describe('resolvePageKeyFromRouteResult', () => {
  it.each([
    ['/', 'map'],
    ['/handbook', 'handbook'],
    ['/more', 'more'],
    ['/settings', 'settings'],
    ['/about', 'about'],
  ])('maps %s to %s', (path, key) => {
    expect(resolvePageKeyFromRouteResult({ path })).toBe(key);
  });

  it('falls back to map for an unknown path', () => {
    expect(resolvePageKeyFromRouteResult({ path: '/nope' })).toBe('map');
    expect(resolvePageKeyFromRouteResult({})).toBe('map');
  });

  it('works with an object path', () => {
    expect(resolvePageKeyFromRouteResult({ path: { after: '/settings' } })).toBe('settings');
  });
});
