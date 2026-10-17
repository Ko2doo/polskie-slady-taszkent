# Svelte rules

## Modern syntax only

Use Svelte 5 runes throughout: `$state`, `$derived`/`$derived.by`, `$effect`, `$props`,
`$bindable`. Don't write the Svelte 4 style (`export let`, top-level reactive `$:`
statements, `on:click` instead of `onclick`) in new or substantially-rewritten code, even if
an older file nearby still uses it — see "Leave old code alone" in `harness/code-style.md`
for what "old file" means in practice. Before writing non-trivial Svelte code, confirm against the currently
installed Svelte version (`package.json`, per the root rule) that the API you're about to
use hasn't moved — Svelte ships changes often, and a remembered API from an older or newer
version can be subtly wrong.

## "Universal reactivity" — the term, and when to use a plain function vs. a class

A plain function (not a class) that calls `$state` internally and returns its reactive
value — usually through `get` accessors so the caller always reads the current value — and
that can be called both inside and outside `.svelte` components, is what **Svelte's own
documentation calls "Universal Reactivity"** (that's the literal title of the relevant
chapter in the official interactive tutorial, `svelte.dev/tutorial/svelte/universal-reactivity`,
and the pattern is only usable in `.svelte.js`/`.svelte.ts` files). It is *not* called a
"factory function" in Svelte's own material, even though it has the shape of one — if you
want a one-word handle for it in conversation, "universal reactivity function" or
just "a `.svelte.js` state function" is accurate; there isn't a shorter official noun beyond
that. The project's own convention is to name these `createX()`
(`createToggle`, `createToggleOverlay`, `createPhotoSession`, `createCustomPointsStorage`)
and keep them in `lib/state/` or `services/`.

**Default to this pattern for new reactive state.** Reach for a plain ES class instead only
when you genuinely need class-specific things this pattern doesn't give you cleanly —
inheritance, `instanceof` checks, or a large object with many methods where the `class`
syntax is simply more readable than a closure returning an object literal. Note that Svelte
5 classes *can* hold reactive `$state` fields directly (a class field initialized with
`$state(...)` is reactive the same way a `let` is) — that's a legitimate option too, not
just non-reactive builder objects. The existing map builders (`mapPointsBuilder.js`,
`customPointsBuilder.js`) are plain classes *without* reactive fields — they're builder/
service objects, not Svelte state, and that's the right call for what they do; don't read
them as a template for reactive state.

The project's own reference example of this pattern, generalized properly, is
`lib/state/createUIProfile.svelte.js` — one small reusable "profile" (`set`/`patch`/`reset`/
`withProfile`) that `navbar.svelte.js`, `panel.svelte.js`, and `bottomTabbarNav.svelte.js`
(for its animation) each specialize for their own domain instead of three independent, slightly-different
reimplementations of the same shape. See `harness/state-management.md` for the full catalog
of `lib/state/` and the singleton-vs-factory-vs-local-`$state` decision in detail — that
file is the authority on *which* existing piece to reuse or extend; this file is about the
pattern and terminology itself.

## Avoid `writable`/the classic store API in new code — but don't touch what already uses it

Prefer runes over `svelte/store`'s `writable`/`readable`/`derived` for anything new. The
classic store API still has real, current uses in this codebase and those stay as they are:

- `store/i18nextSvelte/translationStore.js` — genuinely needs the store contract (`$i18n`
  auto-subscription is used throughout the app's markup); this is a real, ongoing reason to
  use a store, not a historical leftover.
- `store/ui/errorToast.js`, `store/ui/overlayController.js`, `services/toastController.js`,
  `capacitor/backButton.js`, `services/navigationHistoryHook.js`,
  `store/appStartInitialize.js` — pre-runes code that works correctly. Don't rewrite these
  to runes just to "modernize" them; that's churn with no feature benefit and real
  regression risk (see `harness/testing.md`'s non-regression rule). If you're already
  touching one of these files for an unrelated reason and a small, low-risk improvement is
  obviously right there, fine — but a drive-by full rewrite to runes is not in scope unless
  asked for.

A genuine remaining reason to reach for `writable` in new code: you need Svelte's `$store`
auto-subscription syntax in markup for interop with something that expects the store
contract (a third-party library's own typing/API), the same reason `translationStore.js`
uses it. If that's not the situation, use `$state` instead.

## Improve and extend existing helpers — don't duplicate or over-complicate them

Before writing a new helper, check whether an existing one in `lib/state/`, `services/`, or
`utils/` already does most of what's needed:

- If it's close but missing a capability, **extend it** (add a parameter, add a method) —
  see how `customPointsState.add()` grew an optional `id` parameter to support pre-creating
  a point's id for its photo folder, without becoming a different function.
- If it's solid and reusable but just isn't wired up where it should be, **wire it up**
  rather than reimplementing it — `createToggleOverlay` existed unused before `PhotoSlider`
  started using it instead of a hand-rolled `$effect`.
- If real duplication exists (the *same* logic in two places, not just similar-looking code
  with different behavior), **extract a shared module** — but only the parts that are
  genuinely identical. `mapPopupHtml.js` was extracted from the two map builders because
  `escapeHtml`/`createPopupHTML` were byte-identical; `_transformCoords` stayed separate in
  each builder because it takes a different coordinate shape in each one.
- Extending or sharing code must not make the call site more complicated than the problem
  warrants — see the Unix-philosophy rule in `harness/code-style.md`. If "extending" a
  helper would mean bolting on a config object, a mode flag, and three new branches to cover
  a case used in exactly one place, write that one case as its own small function instead.
