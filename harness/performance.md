# Performance (hybrid app — always, not just "when it's easy")

This is a Capacitor hybrid app. It runs on real phones, including old and low-end Android
devices with little RAM, slow flash storage, and a WebView that is not as fast as a desktop
browser. Every rule below applies **every time**, not only when a feature is already
performance-sensitive by nature. A "small" feature that quietly adds a bridge round-trip, a
synchronous decode, or a few hundred KB to the initial bundle is not small on a weak phone.

## The JS ↔ native bridge is expensive

- Never move a file's bytes through the bridge as base64 when a native operation can do it
  directly. Copying a photo: use `Filesystem.copy` (native-to-native), not
  read-as-base64-then-write-as-base64. A base64 fallback is acceptable only when the native
  path genuinely fails, and should log that it fell back (see `customPointsPhotos.js`).
- Batch or cache bridge calls that would otherwise fire once per item. Getting the app's
  data-directory base uri is one bridge call total, cached after the first use
  (`getDataDirectoryUri()` in `appFiles.js`), not one call per photo url resolved.
- A "startup check" over many files (the orphan-photo reconciliation, for example) should
  cost one directory listing, not one listing per item — see `reconcilePhotos()`.

## Don't block the UI thread with decoding/encoding

- Resizing an image: on a device, let the Camera plugin's own `targetWidth`/`targetHeight`/
  `quality` options do it natively (`photoPicker.js`); only fall back to an in-JS
  `canvas`-based resize (`imageResize.js`) where the native path genuinely can't do it (the
  web/dev build, where the plugin's web implementation ignores those options).
- Keep stored photos small to begin with (the project's convention: long side capped around
  1280px, JPEG quality ~80) rather than storing full camera-resolution images and resizing
  on every display.

## Memory

- Anything that creates a resource tied to the DOM or the bridge (a Blob url, an event
  listener, an observer, a native plugin listener) must be released when it's no longer
  needed — in a Svelte `$effect`'s cleanup function, or explicitly on delete. A cache that
  only ever grows for the lifetime of the app is a bug, not a convenience.
- When the *same* resource can legitimately be in use by more than one consumer at once (the
  same photo shown as a thumbnail and, simultaneously, fullscreen in the viewer), a plain
  "release on unmount" is wrong — it will break the other consumer. Reference-count it, the
  way `customPointsPhotos.js`'s web Blob-url cache does.

## Bundle size and lazy loading

- A library only needed by one feature (Swiper for the photo slider, for example) should be
  imported where it's used, not pulled into a shared/eagerly-loaded module, so routes that
  don't need it don't pay for it.
- Prefer a dynamic `import()` for anything heavy that isn't needed on first paint — a
  fullscreen viewer, an editor dialog, a rarely-used screen.
- A library's CSS, if it ships one, goes through `src/App.css` once (see the Swiper /
  maplibre-gl precedent there) rather than duplicated as a side-effect import in every
  component that happens to use the library.

## Reactivity

- Don't let bookkeeping that has nothing to do with what's rendered live inside a reactive
  store — it will trigger wasted re-renders of whatever's subscribed to that store
  (`errorToast.js` keeps its rate-limit bookkeeping in a plain closure variable for this).
- Prefer resolving data (a photo url, a preview) in the background without blocking the
  thing that depends on it from rendering — show a placeholder, swap in the real content
  once it resolves, rather than awaiting it before the parent can render at all. See
  `resolvePreview()` in `MapPreview.js` and `showPreview()` in `MapSession.svelte.js`: the saved
  points go on the map at once, each cover follows as it resolves.
- Independent startup work runs side by side, not one after another — the map tiles load
  while the style is built (`MapSession.svelte.js`).

## Before shipping a feature, ask yourself

- Does this add a bridge call per item where one call for the whole batch would do?
- Does this decode, resize, or re-encode anything that was already the right size?
- Does this leak a resource (url, listener, timer) that nothing ever releases?
- Does this pull a dependency's code or CSS into a path that doesn't need it?
- Would this still feel responsive on a five-year-old mid-range Android phone?
