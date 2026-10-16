# Testing and non-regression

## Coverage

Every area of `src/` that has logic is covered (Vitest + jsdom + fake-indexeddb, see "Stack"
below) — services, state, stores, Capacitor wrappers, components, screens and the app shell.
What is deliberately left out is listed under "What gets tested" below. Known bugs found while
building the suite are pinned with `it.fails` and logged in `BUGS.md` (see "Bug log"). So: a
change to existing code is expected to keep the suite green, and new code arrives with its tests
(see "What a change needs").

## What gets tested (and what doesn't)

Tests are for **logic**. Not tested: files with no logic — static data (`data/`,
`locales/`), route tables (`Routes.js`), constant files (`views/Map/MapConstants.js`),
icons, and components that are pure markup (they only render props/translations, no
branching, state or event handling — `AppSplash.svelte`, `About.svelte`,
`TechnicalInfo.svelte` and the like). A component *is* tested as soon as it has logic:
conditional rendering driven by state, event handlers, derived values, side effects.
Heavy UI glue around third-party engines (MapLibre in `views/Map/`, the builders) is
tested at the logic level with recorder mocks of the engine — not line by line.

## Bug log (`BUGS.md`)

Bugs found while writing tests are tracked in `BUGS.md` at the repo root so they survive
between sessions. It is **not** imported into `CLAUDE.md` — read it only when the task is
about bugs (or before adding to it, to avoid duplicates).

1. **Found a bug while testing:** pin it with `it.fails` (see "Layout and config" below),
   leave the code alone, and append an entry to `BUGS.md`: next free `BUG-N` id, title,
   status `open`, **Where** (file:line), **What** (what breaks and when), **Test** (test
   file + test name, or "none" if there's no behavior to test), **Fix** (the minimal fix).
   Create the file from the existing header if it doesn't exist.
2. **Asked to fix the bugs** (that request is the go-ahead bug fixes otherwise need): for
   each entry — apply the fix, remove `.fails` (or add the missing test), run the full
   suite, set the status to `fixed`.
3. **Asked to wrap up:** produce the commit message for the fixes (format in
   `harness/git-workflow.md`, `FIX:` prefix, one bullet per `BUG-N`), hand it over, then
   delete `BUGS.md` — only once every entry is `fixed`; otherwise list what's still open
   and keep the file.

## The non-negotiable rule

**Introducing something new must never break something that already worked.** Before
changing a file that other code depends on (a service, a state module, a shared component,
a builder), find out what currently uses it and what the existing tests already cover for
it. After the change, the full existing suite must still pass — a green suite for the new
feature alone is not enough if it came at the cost of a regression nothing is testing.

If you're about to touch widely-used code (`customPointsState.svelte.js`,
`customPointsStorage.js`, `errorToast.js`, the map builders, anything in `utils/`), treat
that as higher-risk and verify more carefully than a one-off component only used in one
place.

## Running

- `npm test` — the whole suite once (`vitest run`). Run it before reporting any step as done.
- `npm run test:watch` — watch mode while developing.
- `npm run test:coverage` — suite + v8 coverage: text summary in the terminal, HTML report
  in `coverage/` (git-ignored). Icons (`lib/icons/`) and translation files (`locales/`) are
  excluded from the numbers — there's no logic in them to test.

## Layout and config

- Tests live **next to the code they test**: `src/utils/crc32.js` →
  `src/utils/crc32.test.js`. Only `src/**/*.test.js` is collected.
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
- **A bug found while writing tests is pinned, not silently fixed.** Write the test for the
  *correct* behavior as `it.fails(...)` with a `// BUG: ...` comment saying what's wrong and
  "remove `.fails` once fixed", report it to the human, and leave the code alone until the
  human says to fix it (bug fixes need a go-ahead — see `harness/git-workflow.md`), and
  log it in `BUGS.md` (see "Bug log" above). Once fixed, `it.fails` turns red by itself — that's the reminder to
  drop `.fails`. Check that the `it.fails` test really flips by applying the fix temporarily.
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

## What a change needs

- New logic (a new exported function, a new branch in existing logic) gets tests covering
  the normal path, the edge cases that actually matter (empty input, the limit value
  itself, a value one past the limit), and the failure path (a rejected promise, an
  unexpected error) where the function is expected to handle it gracefully.
- A fix for a specific bug gets a test that reproduces that bug — written so it fails
  against the old code and passes against the fix. Don't just add a test that happens to
  pass against the new code; confirm it would have caught the regression by checking it
  against the pre-fix behavior (see "self-check" below).
- A security-relevant function (anything that escapes/sanitizes user-provided text before
  it becomes HTML or a file path) gets explicit tests for the hostile inputs it's meant to
  reject — not just the happy path.

## Self-check: mutate the code, confirm the test catches it

For anything non-trivial — a safety check, a piece of business logic a bug in which would
be easy to miss by eye — deliberately break the implementation in the exact way a future
regression would (remove a guard, flip a condition, skip a step) and confirm the relevant
test actually fails. If it doesn't, the test isn't really testing that property; strengthen
it until it does, then put the code back. This matters most for anything touching data
integrity (the two-slot storage, the file format's checksum/limits) or resource lifecycle
(the reference-counted photo urls, the overlay stack).

## Before calling a feature done

1. Run the full existing test suite — nothing that passed before should now fail.
2. New code has tests covering it per the rules above.
3. For anything you're not fully confident about, do the mutate-and-confirm self-check.
4. The project builds cleanly (`vite build` or the project's equivalent) with no new
   warnings introduced.
