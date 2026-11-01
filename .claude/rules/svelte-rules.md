---
paths:
  - "src/**/*.svelte"
  - "src/**/*.svelte.js"
  - "src/store/**"
---

# Svelte rules

## Modern syntax only

Use Svelte 5 runes throughout: `$state`, `$derived`/`$derived.by`, `$effect`, `$props`,
`$bindable`. Don't write the Svelte 4 style (`export let`, top-level reactive `$:`
statements, `on:click` instead of `onclick`) in new or substantially-rewritten code, even if
an older file nearby still uses it (see "Leave old code alone" in `harness/code-style.md`).
Svelte ships changes often: check a non-trivial API against the installed version
(`CLAUDE.md` rule 5).

## Reactive state: a `.svelte.js` function by default, a class when it earns it

The default shape for reusable reactive state is a plain function in a `.svelte.js` file
that calls `$state` internally and returns the value through `get` accessors, usable inside
and outside components — what Svelte's docs call "universal reactivity". The project names
them `createX()` (`createToggle`, `createToggleOverlay`, `createPhotoSession`,
`createCustomPointsStorage`) and keeps them in `lib/state/` or `services/`; the reference is
`lib/state/createUIProfile.svelte.js`. Which existing piece to reuse or extend, and
singleton vs. factory vs. local `$state`: `.claude/rules/state-management.md`.

Use a plain ES class only when it genuinely helps — inheritance, `instanceof` checks, or a
large object with many methods where `class` syntax reads better than a closure. A Svelte 5
class can hold reactive `$state` fields too. The map builders (`mapPointsBuilder.js`,
`customPointsBuilder.js`) are classes *without* reactive fields — builder objects, not
Svelte state; don't read them as a template for reactive state.

## No new `writable` stores — and don't rewrite the existing ones

Prefer runes over `svelte/store`'s `writable`/`readable`/`derived` for anything new. The
only reason to reach for a store in new code is genuine store-contract interop — Svelte's
`$store` syntax for something that expects the contract, the way
`store/i18nextSvelte/translationStore.js` serves `$i18n` across the app's markup.

Pre-runes store code that works stays as it is: `store/ui/errorToast.js`,
`store/ui/overlayController.js`, `services/toastController.js`, `capacitor/backButton.js`,
`services/navigationHistoryHook.js`, `store/appStartInitialize.js`,
`store/i18nextSvelte/translationStore.js` — ESLint rejects `writable`/`readable`/`derived`
anywhere else (`eslint.config.js` → `STORE_FACTORY_EXCEPTIONS`; `capacitor/backButton.js`
only reads a store with `get`, which stays allowed). Rewriting them to runes
to "modernize" is churn with real regression risk (`harness/testing.md`). A small, obviously
right improvement while already touching one for another reason is fine; a drive-by full
rewrite is not, unless asked.
