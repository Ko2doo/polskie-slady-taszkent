import { describe, it, expect, afterEach } from 'vitest';
import { portal } from '@/utils/portal';

describe('portal', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('moves the node from its parent to the end of <body>', () => {
    document.body.innerHTML = '<div id="popup"><div id="viewer"></div></div><div id="last"></div>';
    const node = document.getElementById('viewer');

    portal(node);

    expect(node.parentElement).toBe(document.body);
    expect(document.body.lastElementChild).toBe(node);
    expect(document.getElementById('popup').children).toHaveLength(0);
  });

  it('keeps the very same node (no clone), so Svelte keeps tracking it', () => {
    const parent = document.createElement('div');
    const node = document.createElement('div');
    parent.append(node);
    document.body.append(parent);

    portal(node);

    expect(document.body.lastElementChild).toBe(node);
  });

  it('removes the node from the document on destroy', () => {
    const node = document.createElement('div');
    const action = portal(node);

    action.destroy();

    expect(node.isConnected).toBe(false);
    expect(document.body.contains(node)).toBe(false);
  });
});
