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
- **Reuse what's in `lib/state/` and `utils/` before writing something new.** A needed
  toggle, overlay, or formatting helper may already exist and just not be wired up yet.
- **No dead code left "just in case".** A commented-out block, an unused export, an unused
  import, a file nothing imports — remove it in the same change that makes it dead, not
  "later." Exception: a commented-out `console.log`/`console.error` left for local debugging
  is fine to leave if genuinely useful, but don't add new ones as part of shipped code.

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
