import { describe, it, expect } from 'vitest';
import { createToggle } from '@/lib/state/createToggler.svelte.js';

describe('createToggle', () => {
  it('is closed by default, or starts with the given value', () => {
    expect(createToggle().value).toBe(false);
    expect(createToggle(true).value).toBe(true);
  });

  it('open, close and toggle', () => {
    const toggle = createToggle();

    toggle.open();
    expect(toggle.value).toBe(true);

    toggle.toggle();
    expect(toggle.value).toBe(false);

    toggle.toggle();
    toggle.close();
    expect(toggle.value).toBe(false);
  });

  it('set turns any value into a boolean', () => {
    const toggle = createToggle();

    toggle.set('yes');
    expect(toggle.value).toBe(true);

    toggle.set(0);
    expect(toggle.value).toBe(false);
  });

  it('toggles are independent', () => {
    const first = createToggle();
    const second = createToggle();

    first.open();

    expect(second.value).toBe(false);
  });
});
