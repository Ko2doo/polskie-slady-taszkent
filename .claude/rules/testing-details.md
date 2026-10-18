---
paths:
  - "src/**/*.test.js"
  - "src/test/**"
  - "vitest.config.js"
---

# Writing tests: layout, helpers, mocking

The rules for *what* to test and the non-regression rule are in `harness/testing.md`; this
file is *how*.

## Layout and config

- Tests live **next to the code they test**: `src/utils/crc32.js` →
  `src/utils/crc32.test.js`. Only `src/**/*.test.js` is collected. A test that uses runes itself
  (`$effect.root`, `$state`) is named `*.svelte.test.js` so Svelte compiles it
  (`bottomTabbarNav.svelte.test.js`).
  Three tests are about the harness itself: `src/architectureTree.test.js` checks the `src/`
  tree in `harness/architecture.md` against the real directories, `src/repositoryTree.test.js`
  checks the repo-root tree in `.claude/rules/repository-layout.md` against the working tree minus
  git-ignored files (so a temporary file left in the root fails it too) — both read the trees
  through `src/test/harnessTree.js` (`readTreeBlock`, `parseTree`) — and
  `src/harnessPaths.test.js` checks that every path the agent docs name exists, that every
  `.claude/rules/` file has a `paths:` list whose globs each match a file, and that every
  `harness/` file is `@`-imported by `CLAUDE.md`.
- `vitest.config.js` merges `vite.config.js`, so tests get the same `@` alias, Svelte plugin
  and `__APP_VERSION__`/`__APP_NAME__` globals as the app. It also adds the `browser`
  resolve condition **only under Vitest** — without it `svelte` resolves to its server
  build and `mount()` throws `lifecycle_function_unavailable`.
- `src/test/setup.js` runs before every test file (currently: `fake-indexeddb/auto`).
  Shared test helpers (plugin call recorders, i18n stubs, fixtures) go in `src/test/` too,
  never into app code. Never import anything from `src/test/` in app code.
  `src/test/mapRecorders.js` holds the MapLibre recorders for the map-screen modules and the
  builders — `Marker`/`Popup`/`LngLatBounds`, a style recorder (sources, layers, images, layer
  taps, `resetStyle()` for a theme switch), `stubImageLoading()` (jsdom never loads images),
  `routeResult` — reuse it there.
  `src/test/gpsTrackerRecorder.js` — `createTrackerRecorder()`, a `createGPSTracker()` the test
  drives (`move(position)`, `fail(error)`) for the GPS navigation modules.
  For component tests: `src/test/i18nStub.js` (`$i18n.t` returning the key, plus the
  interpolation values as JSON) and `src/test/reactiveProps.svelte.js` (reactive props, to
  change a prop of a mounted component the way a parent would). Konsta components mount fine in
  jsdom without an `<App>` wrapper; a Konsta `Dialog`/`Sheet`/`Actions` renders its content even
  while closed, so query by text/aria-label rather than by visibility. `src/test/setup.js` stubs
  `Element.prototype.animate` (Svelte transitions need it, jsdom has none).
  `src/test/RenderSnippet.svelte` renders a snippet a screen hands to the navbar/panel profile,
  so its buttons can be clicked. A controller mock that a component stores in `$state` must be a
  class instance: `$state` deep-copies a plain object into a proxy, and the test's later changes
  to the mock would not reach the component.
  `src/test/EmptyComponent.svelte` stands in for a heavy child (`vi.mock(path, () => ({ default:
  EmptyComponent }))`) when a test is about the parent's own wiring; `src/test/ContextProbe.svelte`
  reads a context value so a test can check what a parent provides. `src/test/realI18n.js` is an
  i18n store on the real locale files (`fallbackLng: false`) — use it for components that render
  translation structures (`returnObjects: true`), so a missing entry in one language fails the
  test (see `About.test.js`, `TechnicalInfo.test.js`). Note that Svelte renders `undefined` as an
  empty string: assert that the expected text is there, not that "undefined" is absent.
- `restoreMocks`, `unstubGlobals` and `unstubEnvs` are on: `vi.spyOn`/`vi.stubGlobal`/
  `vi.stubEnv` are undone after every test automatically — don't add manual cleanup for
  those. To test both branches of `IS_DEBUG` (or anything else read from `import.meta.env`
  at module load), `vi.stubEnv(...)`, then `vi.resetModules()` and a dynamic `import()` —
  see `utils/debugMode.test.js`.
- Browser APIs jsdom lacks (`createImageBitmap`, canvas drawing/encoding, layout) are
  replaced with call recorders via `vi.stubGlobal` / `vi.spyOn(HTMLCanvasElement.prototype,
  ...)` — see `utils/imageResize.test.js`. A third-party module that needs real layout
  (Swiper, MapLibre) is replaced with `vi.mock(...)` recording its constructor calls — see
  `utils/swiperAction.test.js`.
- Components that read `$i18n` need an `i18n` prop with the store contract; a minimal stub
  is `{ subscribe: (fn) => { fn({ t: (k) => k }); return () => {}; } }` (returns the key, so
  assertions can check which key is rendered).
- A Capacitor plugin export is a Proxy: `vi.spyOn(Filesystem, ...)` fails. To make it
  observable, `vi.mock` the package and wrap each method in a `vi.fn` that calls the real
  web implementation by default; a test then overrides one call with
  `mockRejectedValueOnce(...)` to simulate a native-only error code — see
  `capacitor/utils/appFiles.test.js`. Use the `...Once` variants: `restoreMocks` doesn't
  reset a `vi.fn` created inside `vi.mock`.
- Services with an injected dependency (`createCustomPointsStorage({ driver })`) are tested
  with an in-memory recorder of that dependency (every call recorded, failures injectable
  per path) plus one integration test against the real implementation — see
  `services/customPointsStorage.test.js`.
- Module-level singletons (`customPointsState`, `articlePopupState`, `themeManager`,
  `errorToast`) keep state between tests in the same file. Reset them in `beforeEach`, or
  use `vi.resetModules()` + a dynamic `import()` to get a fresh instance. IndexedDB from
  fake-indexeddb is also shared within a file — clean up what a test writes.

## Stack

- **Vitest** + **jsdom**, with **fake-indexeddb** loaded in the test setup so the real
  Capacitor Filesystem web implementation (which uses IndexedDB under the hood) runs
  against something real rather than being mocked away. Prefer testing against the real
  web implementation of a Capacitor plugin where practical — it catches real bugs (wrong
  option names, wrong directory, encoding issues) that a hand-rolled mock would hide.
- Mock a native plugin only where the real web implementation can't exercise what you need
  (actual native-only behavior, like confirming a bridge call isn't made a second time, or
  simulating a platform-specific error code) — and when you do, mock it as a recorder of
  every call made, not just a stub that returns a canned value, so a test can assert on
  *what* was called and how many times, not just the end result.
- A Svelte component test mounts the real component (`mount`/`unmount`/`flushSync` from
  `svelte`) and drives it through its actual DOM, not through calling internal functions
  directly — assert on what's rendered and what happens when the user interacts with it.
