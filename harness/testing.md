# Testing and non-regression

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
