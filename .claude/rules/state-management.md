---
paths:
  - "src/lib/state/**"
  - "src/store/**"
  - "src/services/useOverlay.js"
  - "src/**/*.svelte"
  - "src/**/*.svelte.js"
---

# State management (`lib/state/`)

Read this before writing any new reactive state — there is almost always an existing
pattern or base to build on here, and the project is small enough that a new one-off
pattern is rarely justified.

## The base pattern: `createUIProfile`

`createUIProfile.svelte.js` is the headline example of "universal reactivity" in this
codebase (see `.claude/rules/svelte-rules.md` for what that term means) — a generic, reusable
reactive UI profile: a flat object of view-scoped fields that a screen can fully replace
(`set`), partially update (`patch`), or reset to defaults (`reset`). It's the base that
these state modules specialize:

- `navbar.svelte.js` — the navbar's title/snippets, defaults `{ title, leftSnippet,
  rightSnippet, subnavSnippet }`.
- `panel.svelte.js` — the side panel's open state/content, defaults `{ isOpen, side,
  backdrop, floating, title, contentSnippet }`, plus `openPanel`/`closePanel` convenience
  functions on top.
- `bottomTabbarNav.svelte.js` — the bottom tab bar. Visibility is **not** a profile field
  but a count of hide requests: `hideTabbar(slide)` returns a release, the tab bar shows
  when none is held (a shared "last writer wins" field made its return depend on the order
  screens mounted/unmounted in). The profile only holds the slide animation
  `{ duration, delay }`. The count is read under `untrack`: screens call it from `$effect`s,
  which would otherwise subscribe to — and loop on — each other's requests.

Each of these wraps `createUIProfile(defaults)` and exposes only the getters/functions that
make sense for its own domain — `createUIProfile` itself is deliberately generic and knows
nothing about navbars or panels. **If a new screen-level, replace-or-patch UI concern comes
up (a new piece of shared chrome, a new overlay with a similar open/configure/reset shape),
build it the same way: specialize `createUIProfile`, don't write a new state shape from
scratch.** The navbar and the panel expose a `withProfile(cfg)`-style method (`set` + return
a `reset` closure; the tab bar's equivalent is `hideTabbar`) specifically so a screen's
`$effect` can do
`$effect(() => withNavbar({...}))` and get the right cleanup for free — see
`.claude/rules/screens.md` for how every screen actually uses this.

## Toggles and overlays

- `createToggler.svelte.js` — `createToggle(initial)`: the plain open/close/toggle/set
  primitive. Use this when something needs local boolean-ish state and nothing about the
  Android back button.
- `createToggleOverlay.js` — the same API, plus registering with the back-button overlay
  stack (`useOverlay.js`/`overlayController.js`) on open and unregistering on close. **Use
  this whenever the thing being toggled is a modal/overlay that should close on Android
  back** — `PhotoSlider.svelte` (see `.claude/rules/custom-markers-subsystem.md`) is the
  reference usage: the component that decides to open something owns the toggle; the thing
  being opened (`PhotoViewer.svelte`) stays presentational, driven by plain props, not by
  owning its own open state.
- When the open state isn't a toggle the overlay owns — it lives in shared state, or arrives
  as an `opened` prop — register with `overlayController` directly, tied to that state:
  `panel.svelte.js` syncs on every change of `isOpen` (including the `withPanel` reset when a
  screen unmounts); `CustomPointsMapEditorDialog.svelte` registers in an `$effect` on `opened`
  whose cleanup unregisters, so leaving the screen with it open leaves nothing on the stack.
  What's on the stack today: the side panel, the marker editor (its back = cancel, inner
  menu/question first), the article popup (`article.svelte.js`), the photo viewer. Deliberately
  not: the onboarding wizard and `NavigationSheet`.
- The onboarding wizard deliberately uses plain `createToggle()`, not
  `createToggleOverlay` — it should *not* be dismissible by the back button mid-flow. Don't
  "fix" this to use the overlay variant without checking that's actually wanted.

## Feature-specific state modules

- `customPointsState.svelte.js`, `photoSession.svelte.js` — see
  `.claude/rules/custom-markers-subsystem.md`.
- `article.svelte.js` — the shared article/marker popup's open state (module singleton —
  both `Handbook` and the map popup open the same instance).
- `mapMarkerFilter.svelte.js` — the map's all/custom/historical marker filter, persisted via
  `capacitor/utils/appStorage.js` (Preferences), not through the custom-points JSON storage
  — this is UI preference, not marker data.
- `customPointsDialogState.svelte.js` — tracks whether the user has seen the one-time
  "here's how custom markers work" intro dialog (`components/CustomPoints/
  CustomPointsDialog.svelte`, distinct from `CustomPointsMapEditorDialog.svelte`, the actual
  marker editor — don't confuse the two), persisted the same way via Preferences.

## Deciding: singleton module, factory function, or local `$state`?

1. **Local `$state` inside the component.** Default choice. Most state belongs here and
   should not be promoted to `lib/state/` just because it's convenient to name.
2. **A factory (`createX()`, called fresh by each consumer)** — when the *shape* of state
   is reusable but each user of it needs their *own independent instance*. `createToggle`,
   `createToggleOverlay`, `createPhotoSession`, `createUIProfile` and everything built on
   it, `createEditModeController` (one per map screen) are all this.
3. **A module-level singleton** — only when state genuinely must be the *same object*
   everywhere it's used, because independent screens need to observe/drive the exact same
   state. `customPointsState.svelte.js` (map + article popup must see the same points) and
   `articlePopupState` (`article.svelte.js`, shared across every entry point that can open
   an article) are the two examples. This is a deliberate, narrow pattern — don't reach for
   it as the default just because "global" feels simpler than threading props.
4. **A plain `writable` store** — only for genuine store-contract interop (see
   `.claude/rules/svelte-rules.md`). Don't introduce a new one.
