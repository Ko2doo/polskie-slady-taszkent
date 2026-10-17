/**
 * Global test setup (Vitest `setupFiles`), runs before every test file.
 *
 * - `fake-indexeddb/auto` installs an in-memory IndexedDB on the jsdom window. The real web
 *   implementation of `@capacitor/filesystem` stores files in IndexedDB, so tests exercise
 *   the actual plugin code instead of a hand-written mock (see harness/testing.md).
 * - A minimal `Element.prototype.animate` (jsdom lacks the Web Animations API that Svelte
 *   transitions use), see below.
 */
import 'fake-indexeddb/auto';

// jsdom has no Web Animations API, and Svelte transitions (`in:fly`, `out:fade`, ...) call
// element.animate(). A minimal stand-in that "finishes" at once, so components with
// transitions can be mounted and toggled in tests.
if (typeof Element !== 'undefined' && !Element.prototype.animate) {
  Element.prototype.animate = function animate() {
    const animation = {
      onfinish: null,
      oncancel: null,
      currentTime: 0,
      playState: 'finished',
      finished: Promise.resolve(),
      cancel() {},
      finish() {},
      play() {},
      pause() {},
      reverse() {},
    };
    queueMicrotask(() => animation.onfinish?.());
    return animation;
  };
}
