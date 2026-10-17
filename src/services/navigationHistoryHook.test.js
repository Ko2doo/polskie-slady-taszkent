import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

// The router itself is a recorder: goto() is only observed, the post hook is driven by the test
const deps = vi.hoisted(() => ({}));

vi.mock('@mateothegreat/svelte5-router', () => ({ goto: (...args) => deps.goto(...args) }));

// The history and the pending-back flag are module-level: every test imports a fresh copy
let history;

beforeEach(async () => {
  deps.goto = vi.fn();
  vi.resetModules();
  history = await import('@/services/navigationHistoryHook');
});

// What the router does after a navigation: call the global post hook with the route
const arrive = (path) => history.navigationHistoryPostHook({ path });
const state = () => get(history.navigationHistory);

describe('navigationHistoryPostHook', () => {
  it('pushes forward navigations', () => {
    arrive('/');
    arrive('/more');
    arrive('/settings');

    expect(state()).toEqual({ stack: ['/', '/more', '/settings'], current: '/settings', prev: '/more' });
  });

  it('lets the routing continue', () => {
    expect(arrive('/more')).toBe(true);
  });

  it('ignores the same path reported twice', () => {
    arrive('/');
    arrive('/more');
    arrive('/more');

    expect(state().stack).toEqual(['/', '/more']);
  });

  // So that back on the map never goes back to an older screen: the exit flow takes over
  it('going forward to "/" resets the history', () => {
    arrive('/');
    arrive('/more');
    arrive('/');

    expect(state()).toEqual({ stack: ['/'], current: '/', prev: null });
  });

  it('reads the path from a router result too', () => {
    history.navigationHistoryPostHook({ result: { path: { original: '/about' } } });

    expect(state().current).toBe('/about');
  });
});

describe('routerBack', () => {
  it('goes to the previous screen and pops it from the history', () => {
    arrive('/');
    arrive('/more');
    arrive('/about');

    history.routerBack('/');
    expect(deps.goto).toHaveBeenCalledWith('/more');

    arrive('/more');
    expect(state()).toEqual({ stack: ['/', '/more'], current: '/more', prev: '/' });
  });

  it('back to the map leaves just the map', () => {
    arrive('/');
    arrive('/more');

    history.routerBack();
    arrive('/');

    expect(state()).toEqual({ stack: ['/'], current: '/', prev: null });
  });

  it('without history goes to the fallback', () => {
    arrive('/settings');

    history.routerBack('/handbook');

    expect(deps.goto).toHaveBeenCalledWith('/handbook');
  });

  // A back that ended somewhere else (the user tapped a tab meanwhile) is a normal navigation
  it('a navigation to another place after a back is pushed, not popped', () => {
    arrive('/');
    arrive('/more');
    arrive('/about');
    history.routerBack();

    arrive('/handbook');

    expect(state().stack).toEqual(['/', '/more', '/about', '/handbook']);

    arrive('/more');
    expect(state().stack).toEqual(['/', '/more', '/about', '/handbook', '/more']);
  });
});
