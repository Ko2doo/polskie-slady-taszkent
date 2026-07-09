/**
 * Generic reactive UI profile (Svelte 5 runes).
 *
 * A "UI profile" is a flat object of view-scoped UI fields (title, snippets,
 * flags...) that a view can fully replace (set), partially update (patch),
 * or reset to defaults on unmount. Base for navbar/panel/tabbar-like stores
 * that share this exact shape but differ in fields.
 */

export function createUIProfile(defaults) {
  let state = $state({ ...defaults });

  function set(cfg = {}) {
    state = { ...defaults, ...cfg };
  }

  function patch(patchObj = {}) {
    Object.assign(state, patchObj);
  }

  function reset() {
    state = { ...defaults };
  }

  function withProfile(cfg = {}) {
    set(cfg);
    return () => reset();
  }

  const profile = { set, patch, reset, withProfile };

  for (const key of Object.keys(defaults)) {
    Object.defineProperty(profile, key, {
      get: () => state[key],
      enumerable: true,
    });
  }

  return profile;
}
