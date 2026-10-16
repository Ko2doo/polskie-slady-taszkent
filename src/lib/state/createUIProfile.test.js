import { describe, it, expect } from 'vitest';
import { createUIProfile } from '@/lib/state/createUIProfile.svelte.js';

const DEFAULTS = { title: '', isOpen: false, count: 0 };

describe('createUIProfile', () => {
  it('starts with the defaults, exposed as read-only getters', () => {
    const profile = createUIProfile(DEFAULTS);

    expect({ title: profile.title, isOpen: profile.isOpen, count: profile.count }).toEqual(DEFAULTS);
    expect(Object.keys(profile)).toEqual(expect.arrayContaining(['title', 'isOpen', 'count']));
  });

  it('set replaces the whole profile: fields it does not name go back to the defaults', () => {
    const profile = createUIProfile(DEFAULTS);
    profile.set({ title: 'A', count: 2 });

    profile.set({ isOpen: true });

    expect(profile.title).toBe('');
    expect(profile.count).toBe(0);
    expect(profile.isOpen).toBe(true);
  });

  it('patch changes only the named fields', () => {
    const profile = createUIProfile(DEFAULTS);
    profile.set({ title: 'A', count: 2 });

    profile.patch({ count: 3 });

    expect(profile.title).toBe('A');
    expect(profile.count).toBe(3);
  });

  it('reset goes back to the defaults', () => {
    const profile = createUIProfile(DEFAULTS);
    profile.set({ title: 'A', isOpen: true });

    profile.reset();

    expect(profile.title).toBe('');
    expect(profile.isOpen).toBe(false);
  });

  it('withProfile sets and returns the reset for an $effect cleanup', () => {
    const profile = createUIProfile(DEFAULTS);

    const dispose = profile.withProfile({ title: 'Map' });
    expect(profile.title).toBe('Map');

    dispose();
    expect(profile.title).toBe('');
  });

  it('never mutates the defaults object', () => {
    const defaults = { ...DEFAULTS };
    const profile = createUIProfile(defaults);

    profile.patch({ title: 'changed' });
    profile.set({ count: 5 });

    expect(defaults).toEqual(DEFAULTS);
  });

  it('profiles are independent', () => {
    const first = createUIProfile(DEFAULTS);
    const second = createUIProfile(DEFAULTS);

    first.patch({ title: 'first' });

    expect(second.title).toBe('');
  });
});
