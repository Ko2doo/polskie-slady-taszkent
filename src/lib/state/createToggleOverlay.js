import { createToggle } from './createToggler.svelte.js';
import { useOverlay } from '@/services/useOverlay';

/**
 * createToggle that also registers with the back-button overlay stack while open, so Android
 * back closes it. Same API as createToggle. The component that decides to open something owns
 * the toggle; the opened component stays presentational (see PhotoSlider / PhotoViewer).
 * @param {boolean} [initial=false] - open from the start (and registered on the stack)
 * @returns {{ readonly value: boolean, open: () => void, close: () => void, toggle: () => void,
 *   set: (value: unknown) => void }} the toggle; every change keeps the stack in sync
 * @example
 * const viewer = createToggleOverlay();
 * viewer.open(); // Android back now calls viewer.close()
 */
export function createToggleOverlay(initial = false) {
  const toggle = createToggle(initial);

  const { open, close } = useOverlay(() => {
    toggle.close();
  });

  return {
    get value() {
      return toggle.value;
    },

    open() {
      toggle.open();
      open();
    },

    close() {
      toggle.close();
      close();
    },

    toggle() {
      if (toggle.value) {
        this.close();
      } else {
        this.open();
      }
    },

    set(v) {
      if (v) {
        this.open();
      } else {
        this.close();
      }
    },
  };
}
