import { describe, it, expect, beforeEach } from 'vitest';
import { navbarState, patchNavbar, resetNavbar, setNavbar, withNavbar } from '@/lib/state/navbar.svelte.js';

const snippet = () => {};

// Module-level singleton: back to the defaults before every test
beforeEach(() => resetNavbar());

describe('navbarState', () => {
  it('starts empty', () => {
    expect(navbarState.title).toBe('');
    expect(navbarState.leftSnippet).toBeNull();
    expect(navbarState.rightSnippet).toBeNull();
    expect(navbarState.subnavSnippet).toBeNull();
  });

  it('a screen sets its navbar and the cleanup resets it', () => {
    const dispose = withNavbar({ title: 'Handbook', rightSnippet: snippet });

    expect(navbarState.title).toBe('Handbook');
    expect(navbarState.rightSnippet).toBe(snippet);

    dispose();

    expect(navbarState.title).toBe('');
    expect(navbarState.rightSnippet).toBeNull();
  });

  it('setNavbar replaces, patchNavbar merges', () => {
    setNavbar({ title: 'A', leftSnippet: snippet });
    patchNavbar({ title: 'B' });

    expect(navbarState.title).toBe('B');
    expect(navbarState.leftSnippet).toBe(snippet);

    setNavbar({ title: 'C' });

    expect(navbarState.leftSnippet).toBeNull();
  });
});
