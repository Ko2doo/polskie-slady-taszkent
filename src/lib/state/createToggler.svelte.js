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
