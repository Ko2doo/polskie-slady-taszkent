# Dependencies

## Default answer: write it yourself

Before reaching for a package, ask whether the thing it would solve is actually small
enough to write directly, the way this project already has for several things that most
projects would pull a library in for:

- `utils/crc32.js` — a corruption-check checksum, instead of a crc32 npm package.
- `utils/uuid.js` — `crypto.randomUUID()` with a manual RFC-4122-v4 fallback for contexts
  where it's unavailable, instead of the `uuid` package.
- `utils/imageResize.js` — a `canvas`-based downscale, instead of a JS image-resizing
  library, for the one place (the web/dev build) that actually needs it.
- Choosing `Actions` from Konsta (already a dependency) for the "camera or gallery" picker
  menu, instead of a separate action-sheet package.
- A plain `<input type="file">` fallback for the web build via the Camera plugin's own
  `webUseInput` option, instead of adding `@ionic/pwa-elements`.

If the thing is small, self-contained, and doesn't need ongoing maintenance (parsing a
known file format, a checksum, a simple state toggle, wrapping one native API), write it in
`utils/` or `lib/state/` and move on — see the Unix-philosophy rule in
`harness/code-style.md`: a well-scoped one-job function is usually a better fit than a
general-purpose library pulled in for one narrow use. This is the default, not a last
resort.

## When a dependency is genuinely needed: stop and ask

**Never add a package to `package.json` or the lockfile without the human's explicit
yes.** This applies even to a tiny, obviously-safe-looking package. The flow:

1. Confirm the capability really isn't reasonable to write directly (see above) and isn't
   already covered by something installed — check `package.json` first.
2. If it touches a native capability (camera, filesystem, geolocation, sharing, and so on),
   look for an **official Capacitor plugin** (the `@capacitor/*` scope) first. These are
   the default choice for native-adjacent features in this project.
3. If there's no official plugin, evaluate **community options** and actually check whether
   each candidate is alive, not just whether it exists on npm:
   - Recent commits and releases (not just an old "stable" tag nobody has touched in years).
   - Real human activity: more than one contributor where relevant, issues getting
     responses, not a graveyard of unanswered bug reports.
   - Whether it fits *this* project's constraints specifically — weigh it against
     `harness/performance.md` (bundle size, whether it needs heavy native setup, whether it
     adds bridge round-trips) and `harness/architecture.md` (does it duplicate something
     that already exists here).
   - Don't default to the most popular option by download count alone — popularity isn't
     the same as "actively maintained" or "fits this project."
4. Propose **one specific package** (name, and ideally the version you'd pin) with a
   **short reason** — what it's for, why writing it directly isn't reasonable, and why this
   one over alternatives if more than one was considered. Then wait for an explicit
   **yes / no / later** answer before writing any code that imports it.
   - **Yes** → add it to `package.json` and the lockfile as part of the feature's patch, and
     continue the feature.
   - **No** → go back to writing it directly, or drop that part of the feature and say so.
   - **Later** → park that part of the feature clearly and keep going on whatever doesn't
     depend on it.
5. Once approved, keep the footprint minimal: import only the specific modules/submodules
   needed (Swiper's `swiper/modules` for just `Pagination`/`Zoom`, not the whole kitchen
   sink), and route its CSS through `src/App.css` per `harness/performance.md`.

## Re-checking before writing code against a library

Right before implementing the part of a feature that touches an existing dependency —
especially Svelte itself, which changes often — check `package.json` for the currently
installed version and, if anything about the API feels like it might have moved, check that
version's own docs/changelog rather than relying on a possibly-stale memory of an older or
newer version's behavior. This is a quick check, not a research project, but skipping it is
how code ends up calling an API that doesn't exist in the installed version, or missing a
better API that does.
