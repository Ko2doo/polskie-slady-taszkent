import { createToggle } from './createToggler.svelte.js';
import { useOverlay } from '@/services/useOverlay';

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
