# Code style

## Principles

- **KISS, DRY, YAGNI, in that order of priority.** If a simple feature would pull in
  several moving parts (a new abstraction layer, a config object, a plugin system) to
  cover cases nobody asked for, that's a sign to cut it down, not to "future-proof" it.
- **Unix philosophy: one function does one job well, but it can be — and often should be —
  general enough to be reused wherever that job comes up.** A function named for what it
  does should not also do a second, unrelated thing as a side effect. Prefer a few small,
  composable functions over one that takes a mode flag and branches internally into
  different behaviors — `isNotFoundError()`, `ensureDirectory()`, `removeFile()` in
  `appFiles.js` are each one clear job; they get combined by the *caller*, not folded into
  a single do-everything function. "General enough to be reused" means designing the
  function's inputs/outputs around the *job*, not around today's one call site — but it
  doesn't mean adding parameters or branches for jobs nothing actually needs yet (that's
  YAGNI again).
  **Extensible when it's actually needed:** when a new call site needs the same job done
  slightly differently, extend the existing function instead of writing a near-copy — an
  optional parameter (or options-object field) whose default keeps the old behavior, so
  every existing caller works unchanged. `customPointsState.add()` growing an optional `id`
  is the reference case (see `harness/svelte-rules.md`). Once the "extension" would make it
  a *different* job (a mode flag switching between two behaviors), it's a new function
  instead. A function that was extended gets a test for the new parameter **and** keeps
  its existing tests green — that's the proof the old behavior didn't move.
- **Reuse what's in `lib/state/` and `utils/` before writing something new.** A needed
  toggle, overlay, or formatting helper may already exist and just not be wired up yet.
- **No dead code left "just in case".** A commented-out block, an unused export, an unused
  import, a file nothing imports — remove it in the same change that makes it dead, not
  "later." Exception: a commented-out `console.log`/`console.error` left for local debugging
  is fine to leave if genuinely useful, but don't add new ones as part of shipped code.

## Readability and splitting into modules

- **Code must read easily for a human.** Someone opening a file for the first time should
  follow it top to bottom without decoding it. That means: descriptive names over short
  ones, early returns over deep nesting, plain loops/conditions over clever one-liners
  (chained ternaries, dense `reduce`s, bit tricks without a comment), and one level of
  abstraction per function — a function either coordinates steps or does one step, not
  both. If a piece of code needs a long comment to be understood, first try to make the
  code itself simpler; keep the comment for the *why* that code can't express.
- **Split into modules/submodules where it makes the code easier to read.** A file or
  component that mixes several independent concerns gets split by concern — the way
  `views/Map/` is split into `MapLifecycle`, `MapTheme`, `MapNavigation`, `MapEditMode`
  and so on instead of one giant `Map.svelte`. A long function gets broken into named
  helpers. Don't split for the sake of it: a 30-line module that does one thing is fine
  as is, and a split that forces the reader to jump across five files to follow one flow
  made things worse, not better.
- **Builder classes are the exception** (`services/mapPointsBuilder.js`,
  `services/customPointsBuilder.js`, and any future builder of that kind). They stay
  whole: their methods share the builder's internal state and its fluent
  `.withX(...).build()` chain, and splitting them into separate files only scatters that.
  From a builder, extract **only what is (or would be) repeated across builders of the same
  kind** into a shared module — the way `services/mapPopupHtml.js` holds
  `escapeHtml`/`createPopupHTML` that both map builders need. Logic specific to one builder
  stays inside it, even if it's long — and stays readable by the rules above (named private
  methods, clear sections, a class-level JSDoc example per the JSDoc rule below).

## No magic numbers (or magic strings)

A bare literal whose meaning isn't obvious from the line itself — a timeout, a limit, a
distance, a size, a storage key, an event name — gets a named constant:

- `UPPER_SNAKE_CASE`, declared at the top of the module, with the unit in the name or a
  short comment: `RECALC_THROTTLE_MS = 10000`, `MAX_ROUTE_DISTANCE = 50000; // meters`,
  `const THEME_KEY = 'ui.theme'`. A derived value shows its derivation:
  `MAX_FUTURE_MS = 24 * 60 * 60 * 1000`, not `86400000`.
- Where it lives depends on who uses it: one module → top of that module; one screen →
  that screen's constants file (`views/Map/MapConstants.js`); a domain limit several modules
  rely on → exported from the module that owns the rule (`LIMITS`/`SCHEMA_VERSION` in
  `customPointsFormat.js`). Never define the same number twice in two places.
- Native-plugin error codes are their own case: `lib/errors/errorCodes.js` only (see
  `harness/architecture.md`).
- Not magic, leave inline: `0`, `1`, `-1`, `2` for halving/pairs, array indexes, `100` in
  a percentage conversion, and values whose meaning the code right next to them already
  states (`padStart(2, '0')`, `toString(16)`). Also fine inline: CSS values in `<style>`/
  Tailwind classes, and literal inputs/expectations in tests (a test reads better with
  `1280` than with an imported constant — except when the test is *about* the constant's
  limit, then import it so the test follows the rule if it changes).

## Logging

- Never call `console.log` / `console.warn` / `console.error` directly in app code.
- Use the project logger: `import { createLogger, IS_DEBUG } from '@/utils/debugMode';`,
  then `const xLogger = createLogger('ComponentOrModuleName');` once per file, and guard
  every call with `IS_DEBUG && xLogger.error(...)` (or `.log`/`.warn`) so nothing is
  evaluated or printed in a production build.
- A caught error that's silently swallowed without at least a debug-log line is a bug —
  even if falling back to a default is the right user-facing behavior, log why.

## Quoting and formatting

- `.prettierrc` sets `semi: true` and nothing about quote style, so Prettier's default
  (double quotes) applies. In practice: `.js` service/util files in this project use
  **single** quotes by established convention; `.svelte` files (both markup and the
  `<script>` block) use **double** quotes. Match whichever convention the file you're
  editing already uses — don't mix within one file, and don't "fix" a whole file's quote
  style as a side effect of an unrelated change.
- Keep lines at or under 120 characters. Where a single string/attribute pushes a line over
  that, wrap the way the codebase already does it: for a JS object value that's too long,
  put the key on one line and the value indented on the next; for a long `class="..."`
  attribute, wrap it across lines inside the quotes; for a long translation string:
  ```js
  key:
    'a string that would not fit on one line otherwise',
  ```

## JSDoc — mandatory, with usage examples for anything non-trivial

Every exported function gets a JSDoc block: a one-line description, `@param` for each
parameter (with an options object's shape spelled out field by field), `@returns`, and
`@throws` when the function can reject/throw in a way the caller needs to handle. Explain
*why*, not just *what*, for anything non-obvious — e.g. why photo limits don't apply to
already-stored data, why a portal is used instead of plain `position: fixed`.

**For a large or non-obvious unit — a class like `mapPointsBuilder.js`/
`customPointsBuilder.js`, or any function whose correct usage isn't self-evident from its
signature — the class-level or function-level JSDoc block must include an `@example`
showing real, working usage**, not just the parameter list. A reader should be able to
copy the example, adjust the values, and have working code — the existing header comments
in `customPointsFormat.js` and `mapPointsBuilder.js` (showing the full builder chain:
`.withMap(...).withPopup(...).withI18n(...)`) are the bar to match. A one-line description
plus a parameter list is not enough on its own for a 500+-line class or a function whose
contract has real subtleties (ordering requirements, what happens on partial failure, which
fields are local-only vs. exported) — the example is what actually teaches a future reader
(human or agent) how to use it correctly.

A short inline comment explaining a non-obvious *why* directly above the code it explains is
expected everywhere, independent of the JSDoc-example rule above — see the comment about
Konsta's `Popup` transform forcing `PhotoViewer` to use a portal.

## Leave old code alone: legacy zones

The code base has two layers. The newer one (custom markers, storage, photos, the builders,
`createUIProfile`) follows this harness; an older layer predates it and doesn't. "Write code
that reads like the surrounding code" is the right default **only for formatting and naming**
(quote style, indentation, comment density) — in a legacy file, *patterns* still come from the
harness and the reference implementations below, never from the file's own neighbours.

### The legacy zones

Don't copy a pattern from these files into new code. Each line says what's wrong there, so you
know what *not* to repeat; the `BUG-N` ids are in `BUGS.md` while it exists.

| File | Don't copy |
| --- | --- |
| `views/Map/Map.svelte` | fat async `onMount` glue wiring modules through closures, a throw-away theme controller created just to pick the first style |
| `views/Map/MapNavigationGPS.svelte.js` | one 700+-line module mixing GPS tracking, routing, map markers and toasts |
| `views/Map/MapTheme.svelte.js` | commented-out code left in `init`/`reapplyOverlays`; restores overlays by calling into every builder/controller directly |
| `components/LangSwitcher.svelte` | reads the deprecated global `event` (`window.event`) instead of the handler's own argument; commented-out `console.log`s |
| `store/ui/errorToast.js` | English fallback texts in `normalizeError` (`'Unknown error'`), a 400-line store mixing queueing, dedup and rate limiting — *use* it as the one error channel; just don't copy its internals |

### Where to copy patterns from instead

- Data integrity, file I/O, bridge-cost discipline: `services/customPointsFormat.js`,
  `customPointsStorage.js`, `customPointsPhotos.js`, `capacitor/utils/appFiles.js`.
- Reactive state: `lib/state/createUIProfile.svelte.js` and its three specializations,
  `photoSession.svelte.js`, `createToggleOverlay.js` as used by `PhotoSlider.svelte`.
- Resource lifecycle (urls, listeners released, ref-counting): `customPointsPhotos.js`,
  `PhotoSlider.svelte` / `PhotoViewer.svelte`.
- Builders: `services/mapPointsBuilder.js`, `customPointsBuilder.js`.

### What touching a legacy file means

- Agreed strategy (2026-10-17): bug fixes from `BUGS.md` first, then **every file in the
  table is brought up to the harness** in separate, explicitly-scoped refactoring steps —
  the most fragile places first (`Map.svelte`'s mount/teardown, the navigation ↔ theme
  wiring, `MapNavigationGPS`). The goal is an empty table.
- Until then, a change in a legacy file stays scoped to its task: fix the bug or add the
  feature with harness-conforming code, and don't rewrite the surrounding old code as a
  drive-by (see the non-regression rule in `harness/testing.md`).
- A file leaves the table in the change that removes its last listed problem — update the
  row (or delete it) in that same change, like any other harness drift.
