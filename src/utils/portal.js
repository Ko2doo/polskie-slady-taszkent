/**
 * portal: Svelte action that moves the element to the end of <body> on mount
 *
 * A fullscreen overlay (like PhotoViewer) must not be positioned relative to a transformed or
 * overflow:hidden ancestor (Konsta's Popup, used by the article screen, is both: it centers itself
 * with a CSS transform, which turns it into the containing block for any `position: fixed`
 * descendant, and clips with overflow-hidden). Moving the node straight into <body> sidesteps
 * both: `fixed` is then relative to the real viewport again, and nothing can clip it.
 *
 * Svelte's own lifecycle (reactivity, $effect, component unmount) is unaffected: it tracks the
 * DOM node itself, not where in the tree it currently lives.
 */

/**
 * @param {HTMLElement} node - Element to move
 * @returns {{ destroy: Function }}
 */
export function portal(node) {
  document.body.appendChild(node);

  return {
    destroy() {
      node.remove();
    },
  };
}
