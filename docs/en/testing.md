# Tests and code quality

## Running

```bash
npm test
npm run test:watch
npm run test:coverage
npx vitest run src/services/customPointsMerge.test.js
```

Stack: **Vitest** + **jsdom** + **fake-indexeddb**. The latter lets the Filesystem plugin's web
implementation really work in tests. `vitest.config.js` extends `vite.config.js`, so tests get
the same `@` alias, plugins and build globals. Only `src/**/*.test.js` files count as tests.

## What to test

- Logic: services, state, stores, Capacitor wrappers, components with branches, handlers or
  effects.
- Not tested: static data (`data/`, `locales/` — apart from key parity), the route table, constant
  files, icons, markup-only components.
- A new function: the normal path, the edge cases (empty input, exactly the limit, the limit + 1)
  and the failure path.
- A bug fix: a test that fails without the fix and passes with it.
- Functions that escape user text for HTML or paths are tested against hostile input.

Before a PR the whole suite must be green, not just the new tests.

## Where tests live

A test sits next to its module: `utils/crc32.js` → `utils/crc32.test.js`. A test that itself uses
runes (`$state`, `$effect.root`) is named `*.svelte.test.js`.

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRateLimiter } from '@/utils/rateLimiter';

let limiter;

beforeEach(() => {
  vi.useFakeTimers();
  limiter = createRateLimiter({ windowMs: 1000, maxPerWindow: 3 });
});

afterEach(() => vi.useRealTimers());

describe('createRateLimiter', () => {
  it('lets the first maxPerWindow hits of a key through, limits the next ones', () => {
    const hits = Array.from({ length: 5 }, () => limiter.isLimited('a'));
    expect(hits).toEqual([false, false, false, true, true]);
  });
});
```

## Components

A component is mounted for real (`mount`/`unmount`/`flushSync` from `svelte`); the test works
through the DOM and checks what the user sees.

```js
import { flushSync, mount, unmount } from 'svelte';
import SearchBar from '@/components/SearchBar.svelte';

const i18n = {
  subscribe(listener) {
    listener({ t: (key) => key });
    return () => {};
  },
};

const target = document.createElement('div');
const component = mount(SearchBar, { target, props: { i18n, items: [], onResults: vi.fn() } });
flushSync();

unmount(component);
```

- The `i18n` stub returns the key, so a test checks which key was rendered. A ready stub is
  `src/test/i18nStub.js`. `src/test/realI18n.js` plugs in the real locales: that way a string
  missing in one language fails the test.
- Konsta `Dialog`/`Sheet`/`Actions` render their content even while closed. Query elements by
  text or `aria-label`, not by visibility.
- `src/test/setup.js` stubs `Element.prototype.animate`: jsdom has none, and Svelte transitions
  need it.

## Helpers (`src/test/`)

| Helper | What for |
| --- | --- |
| `mapRecorders.js` | MapLibre recorders: `Marker`, `Popup`, `LngLatBounds`, the style (sources, layers, images, `resetStyle()`), `stubImageLoading()`, `routeResult()` |
| `gpsTrackerRecorder.js` | `createTrackerRecorder()` — a tracker the test drives: `move(position)`, `fail(error)` |
| `i18nStub.js`, `realI18n.js` | An i18n stub and the real locales |
| `reactiveProps.svelte.js` | Reactive props: change a mounted component's prop the way a parent would |
| `RenderSnippet.svelte` | Renders a snippet a screen handed to the navbar or the panel |
| `EmptyComponent.svelte` | Stands in for a heavy child via `vi.mock(path, () => ({ default: EmptyComponent }))` |
| `ContextProbe.svelte` | Reads a context value |

## Mocks

- **Capacitor plugins.** Prefer running the real web implementation: it catches wrong options,
  directories and encodings. A mock is needed only for device-only behavior. A plugin export is a
  Proxy, so `vi.spyOn(Filesystem, ...)` doesn't work. Mock the package with `vi.mock` and wrap each
  method in a `vi.fn` that calls the web implementation by default. A device error is injected with
  `mockRejectedValueOnce(...)`. Example: `capacitor/utils/appFiles.test.js`.
- **A mock is a recorder.** It records every call instead of only returning a canned value: the
  test checks what exactly was called and how many times.
- **Injected dependencies.** `createCustomPointsStorage({ driver })` is tested with an in-memory
  driver recorder plus one integration test on the real driver
  (`services/customPointsStorage.test.js`).
- **Singletons** (`customPointsState`, `articlePopupState`, `themeManager`, `errorToast`) keep
  their state between the tests of one file. Reset them in `beforeEach`, or get a fresh instance
  with `vi.resetModules()` + a dynamic `import()`.
- `restoreMocks`, `unstubGlobals`, `unstubEnvs` are on in the config, so `vi.spyOn`,
  `vi.stubGlobal` and `vi.stubEnv` are undone automatically.

## Self-check

For important logic (data integrity, limits, reference counts, the overlay stack), break the code
the way a future regression would: remove a check, flip a condition. The test must fail. If it
doesn't, it isn't checking that property.

## Tests that check the project itself

| Test | Checks |
| --- | --- |
| `src/locales/resources.test.js` | Parity of keys, placeholders and HTML tags across all locales |
| `src/lib/errors/errorCodes.test.js` | No error-code literals bypassing `ERROR_CODES` |
| `src/docsParity.test.js` | `docs/ru` and `docs/en`: the same files, heading structure, example code |
| `src/architectureTree.test.js`, `src/repositoryTree.test.js`, `src/harnessPaths.test.js` | The agent rules and the docs match the real file tree |

## Linter and formatting

```bash
npm run lint
npm run lint:fix
npm run format
npm run format:check
```

ESLint (`eslint.config.js`) checks:

- no `console.*`, use the `utils/debugMode.js` logger;
- no unused variables and imports (`_name` marks a parameter kept only for its position);
- `const` wherever nothing reassigns;
- JSDoc on every exported function and class;
- import boundaries: plugins only from `capacitor/`, no new classic stores.

Prettier: semicolons; single quotes in `.js`, double in `.svelte`; 120-character width.
`npm run build` runs lint and format:check first, and so does CI. A rule is switched off only on
one line, with the reason:

```js
// eslint-disable-next-line svelte/no-at-html-tags -- markup from our own locale files
```
