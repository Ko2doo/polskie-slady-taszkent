/**
 * A reactive open/closed flag. Use it for local state that has nothing to do with the Android
 * back button; for an overlay that back should close, use createToggleOverlay.
 * @param {boolean} [initial=false] - the starting value
 * @returns {{ readonly value: boolean, open: () => void, close: () => void, toggle: () => void,
 *   set: (value: unknown) => void }} `set` coerces its argument to a boolean
 * @example
 * const menu = createToggle();
 * menu.open();
 * menu.value; // true
 */
export function createToggle(initial = false) {
  let open = $state(initial);

  return {
    get value() {
      return open;
    },

    open() {
      open = true;
    },

    close() {
      open = false;
    },

    toggle() {
      open = !open;
    },

    set(v) {
      open = !!v;
    },
  };
}
