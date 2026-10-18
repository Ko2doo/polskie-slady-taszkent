# Testing and non-regression

## Coverage

Every area of `src/` that has logic is covered (Vitest + jsdom + fake-indexeddb) — services,
state, stores, Capacitor wrappers, components, screens and the app shell.
What is deliberately left out is listed under "What gets tested" below.

## What gets tested (and what doesn't)

Tests are for **logic**. Not tested: files with no logic — static data (`data/`,
`locales/` — apart from the cross-locale parity check), route tables (`Routes.js`),
constant files (`views/Map/MapConstants.js`),
icons, and components that are pure markup (they only render props/translations, no
branching, state or event handling — `About.svelte`,
`TechnicalInfo.svelte` and the like). A component *is* tested as soon as it has logic:
conditional rendering driven by state, event handlers, derived values, side effects.
Heavy UI glue around third-party engines (MapLibre in `views/Map/`, the builders) is
tested at the logic level with recorder mocks of the engine — not line by line.

## Bug log (`BUGS.md`)

Bugs found while writing tests are tracked in `BUGS.md` at the repo root so they survive
between sessions. It is **not** imported into `CLAUDE.md` — read it only when the task is
about bugs (or before adding to it, to avoid duplicates).

1. **Found a bug while testing:** don't fix it silently (bug fixes need a go-ahead,
   `harness/git-workflow.md`). Write the test for the *correct* behavior as `it.fails(...)`
   with a `// BUG: ...` comment saying what's wrong and "remove `.fails` once fixed" — once
   fixed, it turns red by itself, the reminder to drop `.fails`; check it really flips by
   applying the fix temporarily. Report it to the human and append an entry to `BUGS.md`:
   next free `BUG-N` id, title, status `open`, **Where** (file:line), **What** (what breaks
   and when), **Test** (test file + test name, or "none" if there's no behavior to test),
   **Fix** (the minimal fix). If the file doesn't exist, create it with this header:
   ```markdown
   # Known bugs

   Working log of bugs found while covering the project with tests. Lifecycle and rules:
   `harness/testing.md` → "Bug log". Temporary: deleted once every entry is fixed and the fix
   summary has been handed over for the commit.

   Status: `open` (pinned by an `it.fails` test, code untouched) → `fixed` (code fixed, `.fails`
   removed, suite green, a **Fixed:** line saying what changed — the source for the final commit
   message).
   ```
   and add its line to the root tree in `.claude/rules/repository-layout.md`
   (`├── BUGS.md  # temporary bug log (harness/testing.md → "Bug log")`).
2. **Asked to fix the bugs** (that request is the go-ahead bug fixes otherwise need): for
   each entry — apply the fix, remove `.fails` (or add the missing test), run the full
   suite, set the status to `fixed` and add a **Fixed:** line (date + what actually changed,
   one or two lines) — the wrap-up commit message is assembled from those lines.
3. **Asked to wrap up:** produce the commit message for the fixes (format in
   `harness/git-workflow.md`, `FIX:` prefix, one bullet per `BUG-N`), hand it over, then
   delete `BUGS.md` (and its line in the root tree of `.claude/rules/repository-layout.md`) — only
   once every entry is `fixed`; otherwise list what's still open and keep the file.

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

## Writing tests

Test layout, config, shared helpers and mocking patterns: `.claude/rules/testing-details.md`
(loaded automatically when a test file or `src/test/` is opened).

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

The merge gate (`harness/git-workflow.md` → "Merge gate") — whole suite green, clean build,
new code tested per the rules above — plus the mutate-and-confirm self-check for anything
you're not fully confident about.
