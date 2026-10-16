# Known bugs

Working log of bugs found while covering the project with tests. Lifecycle and rules:
`harness/testing.md` → "Bug log". Temporary: deleted once every entry is fixed and the fix
summary has been handed over for the commit.

Status: `open` (pinned by an `it.fails` test, code untouched) → `fixed` (code fixed, `.fails`
removed, suite green).

## BUG-1 · `getRawPathFromRoute` crashes on a missing route result — open

- **Where:** `src/utils/routerUtils.js:8`
- **What:** `if (!result) '';` is missing `return`, so `undefined`/`null` falls through to
  `result.path` and throws a `TypeError`. Map, Handbook, Settings and About call
  `resolvePageKeyFromRouteResult(route?.result)`, which can be `undefined`.
- **Test:** `src/utils/routerUtils.test.js` → "returns an empty string for a missing result"
  (`it.fails`).
- **Fix:** `if (!result) return '';`
- **Seen for real:** mounting `Handbook` with a `route` that has no `result` crashes on this
  (found while writing `Handbook.test.js`).

## BUG-2 · `InMemoryPMTilesSource` ignores the offset of a `Uint8Array` view — open

- **Where:** `src/utils/inMemoryPmtilesSource.js` (constructor)
- **What:** a `Uint8Array` is stored as `data.buffer`, ignoring `byteOffset`/`byteLength`,
  so a subarray serves bytes from the wrong position. Latent: the app passes an
  `ArrayBuffer` today.
- **Test:** `src/utils/inMemoryPmtilesSource.test.js` → "respects the byteOffset of a
  Uint8Array view" (`it.fails`).
- **Fix:** `data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)`; also
  rename the `lenght` parameter of `getBytes` to `length`.

## BUG-3 · Dead import in `More.svelte` — open

- **Where:** `src/views/More/More.svelte:7`
- **What:** `resolvePageKeyFromRouteResult` is imported but never used (dead code, see
  `harness/code-style.md`). No behavior impact.
- **Test:** none (no behavior to test).
- **Fix:** remove the import.

## BUG-4 · A cached route in the opposite direction starts at the wrong end — open

- **Where:** `src/services/navigationLoader.js` (`findRoute` / `getCacheKey`)
- **What:** the cache key is direction-free on purpose (A→B also serves B→A), but the cached
  value is returned as is, so a B→A request gets the A→B line: `coordinates[0]` is A, not
  the requested origin. Latent today: the route is drawn without direction arrows, and
  fitBounds / the off-route check don't depend on the order. Breaks as soon as anything
  reads the line's direction (turn-by-turn, "next point", progress along the route).
- **Test:** `src/services/navigationLoader.test.js` → "a route from the cache starts at the
  requested origin" (`it.fails`).
- **Fix:** on a cache hit whose first coordinate isn't the requested origin (compared at the
  cache key's 5-decimal precision), return a copy with `geometry.coordinates` reversed;
  don't mutate the cached object. Valid because the pedestrian graph is two-way.

## BUG-5 · Dead commented-out code in `NavigationEngine` — open

- **Where:** `src/services/navigation.js` (constructor)
- **What:** the old adjacency/integrity-check implementation is left commented out above
  the current one (dead code, see `harness/code-style.md`). No behavior impact.
- **Test:** none (no behavior to test).
- **Fix:** delete the commented-out block.

## BUG-6 · The map filter restore can overwrite the user's pick — open

- **Where:** `src/lib/state/mapMarkerFilter.svelte.js` (`hydrate`)
- **What:** the saved filter is restored in the background; if the user picks a filter
  before the read finishes, the restore overwrites the pick in memory (the storage keeps the
  user's value, so the screen and the storage disagree until the next pick). Low impact: on a
  device the window is one Preferences bridge round-trip at app start.
- **Test:** `src/lib/state/mapMarkerFilter.test.js` → "a filter picked before the restore
  finished is kept" (`it.fails`).
- **Fix:** set a module-level `isPickedByUser = true` in `select()`, and return early from
  `hydrate()` when it is set.

## BUG-7 · Swapped debug log messages in `customPointsDialogState` — open

- **Where:** `src/lib/state/customPointsDialogState.svelte.js` (`load`)
- **What:** `seen = true` logs "showing dialog", `seen = false` logs "already seen - hiding
  dialog" — the opposite of what happens. Debug output only; no behavior impact.
- **Test:** none (no behavior to test).
- **Fix:** swap the two messages.

## BUG-8 · `markCompleted` can never report a failed save — open

- **Where:** `src/lib/state/customPointsDialogState.svelte.js` (`markCompleted`)
- **What:** undesired behavior rather than a crash. `markCompleted` wraps `setStorage` in
  try/catch and re-throws, but `setStorage` (`capacitor/utils/appStorage.js`) swallows every
  error itself, so the `catch` is dead and `seen` becomes `true` even when nothing was saved —
  the intro dialog silently shows again on the next launch.
- **Test:** none yet (decide the intended contract first: should a failed save be reported?).
- **Fix:** either make the caller able to see the failure (e.g. `setStorage` returning a
  boolean, checked here) or drop the dead try/catch and document that it's best-effort.
- **Same pattern:** `src/store/appStartInitialize.js` — the `catch` blocks of `initFirstLaunch`
  and `markFirstLaunchCompleted` are dead for the same reason (`getStorage`/`setStorage` never
  throw). `initFirstLaunch` still behaves right (a failed read returns `null` → onboarding
  shown); `markFirstLaunchCompleted` hides the wizard even when the flag wasn't saved, so the
  onboarding shows again on the next launch. Fix both together.

## BUG-9 · The Handbook layout restore reverts the user's pick — open

- **Where:** `src/store/ui/layoutView.js` (`hydrate`)
- **What:** same race as BUG-6, worse: if the user switches to rows before the background
  read finishes, the restore resets the layout — even with nothing saved, it maps `null` to
  grid and overwrites the pick. Low impact: the window is one Preferences round-trip at
  startup.
- **Test:** `src/store/ui/layoutView.test.js` → "a layout picked before the restore finished
  is kept" (`it.fails`).
- **Fix:** `let isPickedByUser = false`, set it in `set()`, return early from `hydrate()`
  when it's set (same fix as BUG-6).

## BUG-10 · Hard-coded English fallback labels in `errorToast` — open

- **Where:** `src/store/ui/errorToast.js` (`ACTION_LABELS`, `sanitizeAction`)
- **What:** an action without a `label` gets `'Open Settings'` / `'Retry'` / `'Action'` —
  user-visible text outside i18next (`harness/i18n.md`). Latent: every current caller passes
  a translated `label`.
- **Test:** none (the fix decides the contract; the current test only checks a label exists).
- **Fix:** make `label` required (drop the action with a debug warning when missing), or take
  the fallbacks from `ui:buttons:*` keys in all four locales.

## BUG-11 · Dead `'added'` binding in `translationStore` — open

- **Where:** `src/store/i18nextSvelte/translationStore.js` (`bindOnChange`)
- **What:** `i18n.on('added', ...)` never fires: i18next emits `added` on `i18next.store`,
  not on the instance. No impact today (resources are bundled statically, nothing adds them at
  runtime), but a future `addResourceBundle` wouldn't re-render `$i18n`.
- **Test:** none (no current behavior depends on it).
- **Fix:** `i18n.store.on('added', setupI18n)`, or drop the binding if runtime resources are
  never planned.

## BUG-12 · `setStorage`/`getStorage` change the type of a JSON-looking string — open

- **Where:** `src/capacitor/utils/appStorage.js`
- **What:** non-objects are stored with `String(value)` but always read back with
  `JSON.parse`, so `setStorage(k, '42')` reads back `42`, `'true'` → `true`, `'null'` → `null`.
  Latent: every current key holds a word (`'en'`, `'all'`, `'layoutRows'`) or a real boolean.
- **Test:** `src/capacitor/utils/appStorage.test.js` → "a string that looks like JSON comes
  back as a string" (`it.fails`).
- **Fix:** serialize every value with `JSON.stringify`. Backwards compatible: values saved
  earlier as raw text (`en`) still fail `JSON.parse` and come back as the raw string. Checked:
  with this fix the rest of the suite stays green.

## BUG-13 · Native geolocation error codes are never recognized — open

- **Where:** `src/capacitor/services/locationPermission.js` (`mapGeolocationError`)
- **What:** `@capacitor/geolocation` reports hyphenated codes (`OS-PLUG-GLOC-0007`, see its
  README), the mapper only accepts `OS_PLUG_GLOC_*`, so native errors fall through to message
  guessing. "Location services are not enabled." (0007) matches none of the message rules and
  becomes the generic 0002. Effects on a device: `isLocationServicesEnabled()` reports `true`
  with GPS switched off (so `checkLocationReadiness()` says ready), and during GPS navigation
  the user gets the generic error toast instead of the "turn on location services" one
  (`MapNavigationGPS.handleGPSError`). 0010 (timeout) happens to be mapped right because its
  message contains "timeout".
- **Test:** `src/capacitor/services/locationPermission.test.js` → "maps the native plugin code
  OS-PLUG-GLOC-0007" and "the native "services not enabled" error means off" (`it.fails`).
- **Fix:** in `mapGeolocationError`, accept a string code starting with `OS-PLUG-GLOC-` and
  return it with `-` replaced by `_` (the `ERROR_CODES` values). Optional cleanup in the same
  change: "Priority 2" in the message rules is unreachable (any message with "off" already
  returned 0007 in "Priority 1").

## BUG-14 · Route progress is not reset after an off-route recalculation — open

- **Where:** `src/views/Map/MapNavigationGPS.svelte.js` (`checkAndRecalculateRoute` →
  `calculateRouteFromGPS` → `displayRoute`)
- **What:** `gpsTracker.resetRoute()` is called when navigation starts or the destination
  changes, but not when a new route replaces the old one after going off route. The tracker
  keeps searching the new route in a window around the *old* progress index; the new route
  starts at the user, so on a route longer than ~60 points the user is "off route" again and
  the route is recalculated every `RECALC_THROTTLE_MS` (10 s), indefinitely.
- **Test:** `src/views/Map/MapNavigationGPS.test.js` → "a recalculated route resets the
  route progress" (`it.fails`); the tracker side of the mechanism is in `gpsTracker.test.js`.
- **Fix:** call `gpsTracker.resetRoute()` in `displayRoute()` (every new route), or right
  before `calculateRouteFromGPS()` in `checkAndRecalculateRoute()`.

## BUG-15 · Attribute injection (XSS) in the map popup — open — security, fix first

- **Where:** `src/services/mapPopupHtml.js` (`escapeHtml`, used by `createPopupHTML`)
- **What:** `escapeHtml` escapes via `textContent` → `innerHTML`, which escapes `<`, `>`, `&`
  but **not quotes**. `createPopupHTML` puts the escaped title into `alt="…"` and the id into
  `data-article-id="…"`, and both builders insert the result with `container.innerHTML`; there
  is no CSP in `index.html`. A custom marker title like `x" onload="…` adds an event handler
  to the preview `<img>` and runs as soon as the popup's preview loads. Today it is self-XSS
  (the user types it into their own app); with the planned import of marker files
  (`customPointsFormat` is built for it) it becomes a real one. Custom ids are validated
  UUIDs, but titles are free text.
- **Test:** `src/services/mapPopupHtml.test.js` → "a quote cannot break out of an attribute"
  (`it.fails`).
- **Fix:** also escape `"` → `&quot;` and `'` → `&#39;` in `escapeHtml` (checked: flips the
  pinned test, the rest stays green).

## BUG-16 · The map popup preview never releases its photo url (web build) — open

- **Where:** `src/views/Map/MapPreview.js` (`resolvePreview`) / `Map.svelte` (`refreshPreview`)
- **What:** `getPhotoUrl()` takes one reference of a reference-counted Blob url on the web, and
  nothing calls `releasePhotoUrl()` for it; every refresh takes another one. The Blob urls of
  covers are never revoked while the app runs. Web/dev build only — on a device the url is a
  plain `convertFileSrc` string with nothing to release.
- **Test:** none yet (needs `Map.svelte`-level coverage).
- **Fix:** keep the previous preview path per point in `Map.svelte` and `releasePhotoUrl()` it
  when the preview is replaced, the point is removed, or the map is destroyed.

## BUG-17 · Leftover dead code in map modules — open

- **Where:** `src/views/Map/MapEditMode.svelte.js:1` (commented-out `maplibre-gl` import),
  `src/services/navigationHistoryHook.js` (`routerBack` destructures `current` and never uses
  it), `src/services/mapStyle.js` (commented-out attribution lines in the source definition),
  `src/components/Article.svelte` (`handleBack` and the `routerBack` import are unused; the
  commented-out `articleId`/`meta` lines; `text="Back"` on `NavbarBackLink` is never shown —
  `showText` defaults to `false`), `src/components/CustomPoints/CustomPointsDialog.svelte`
  (`dialogState` is created and never used).
- **What:** dead code per `harness/code-style.md`. No behavior impact.
- **Test:** none.
- **Fix:** remove them.

## BUG-18 · Turning GPS mode off keeps the position watch running — open

- **Where:** `src/views/Map/MapNavigationGPS.svelte.js` (`toggleGPSMode` → `clearGPSNavigation`)
- **What:** switching GPS mode off only clears the state; `gpsTracker.stop()` is called only by
  `dispose()` (when the map screen is destroyed). The native watch keeps running — battery
  drain and the system "location in use" indicator stay on — and `handlePositionUpdate` has no
  `gpsMode` guard, so the next position puts the user marker back on the map (and can fire the
  out-of-bounds toasts) while GPS mode is off.
- **Test:** `src/views/Map/MapNavigationGPS.test.js` → "stops tracking: the next position does
  not bring the marker back" (`it.fails`).
- **Fix:** when the mode goes off, `gpsTracker?.stop()`, `gpsTracker = null`, `gpsReady = false`
  (so turning it on again starts a fresh watch through `initGPS`). Checked: flips the pinned
  test, the rest stays green.

## BUG-19 · Cancelling "new destination?" still switches the destination — open

- **Where:** `src/views/Map/MapNavigationGPS.svelte.js` (`handleMapClick`, `closeDialog`)
- **What:** a click while navigating writes the new `destinationPoint` before asking; the
  dialog's cancel only closes the dialog. The old route stays on screen, but arrival and the
  next off-route recalculation already head to the new point. (Manual mode is fine: it doesn't
  touch its points until confirmed.)
- **Test:** `src/views/Map/MapNavigationGPS.test.js` → "cancelling keeps heading to the old
  destination" (`it.fails`).
- **Fix:** keep the click in a `pendingDestination`; `confirmNewDestination()` moves it into
  `destinationPoint`, cancel drops it. Checked: flips the pinned test, the rest stays green.

## BUG-20 · A theme switch during GPS navigation drops the route line — open

- **Where:** `src/views/Map/Map.svelte` (step 8: `createThemeController({ ..., navigation })`) +
  `src/views/Map/MapTheme.svelte.js` (`reapplyOverlays`)
- **What:** `map.setStyle()` removes every app layer, and `reapplyOverlays` restores only
  `navigation.currentRoute` — the *manual* controller's route. The GPS controller is never given
  to the theme controller, so toggling dark mode while GPS-navigating removes the route from
  the map until the next off-route recalculation (the user marker is a DOM marker and survives).
- **Test:** none yet (needs `Map.svelte`-level coverage). `MapTheme.test.js` covers that the
  route it is given gets restored.
- **Fix:** pass the active route to the theme controller — e.g. `reapplyOverlays` reads
  `getCurrentRoute()` given by `Map.svelte` (`navigation.currentRoute ?? gpsNavigation.currentRoute`).

## BUG-21 · Theme listeners leak on every map visit and quick switch — open

- **Where:** `src/views/Map/Map.svelte` (steps 2 and 8) and `src/views/Map/MapTheme.svelte.js`
  (`applyTheme` → `onIdle`)
- **What:** two leaks of the same kind (`harness/performance.md`: a listener nothing releases is
  a bug):
  1. `Map.svelte` creates a first theme controller (`map: null`) and calls its `init()` —
     subscribing to `themeManager` — then replaces it with a second one without `dispose()`.
     Every visit to the map screen leaves one subscription behind for the app's lifetime.
  2. In `applyTheme`, an outdated `onIdle` (the theme was switched again before the style
     loaded) returns early *before* `map.off('idle', onIdle)`, so each quick switch leaves one
     idle listener on the map until it is destroyed.
- **Test:** (2) `src/views/Map/MapTheme.test.js` → "two quick switches leave no idle listener
  behind"; (1) `src/views/Map/Map.test.js` → "no theme controller is left subscribed" (both
  `it.fails`).
- **Fix:** (1) `theme.dispose()` before replacing it in `Map.svelte` (or create it once and give
  it the map later); (2) call `map.off('idle', onIdle)` first thing in `onIdle`. Checked: (2)
  flips the pinned test, the rest stays green.

## BUG-22 · Hard-coded English user-visible text — open

- **Where:**
  - `src/components/CustomPoints/CustomPointsDialog.svelte` (`dialogCompleted`): toast
    `"Failed to save settings. Please try again."`
  - `src/views/OnboardingWizard/OnboardingWizard.svelte`: toasts `"Failed to request location
    permission"` (`handleRequestPermission`) and `"Failed to save settings. Please try again."`
    (`completeOnboarding`); `alt="App logotype"` on the logo.
- **What:** user-visible text (and an `alt`) outside i18next (`harness/i18n.md`), English in every
  language. Related cleanup in the onboarding: it compares `err.code` with the literal strings
  `"WEB_PLATFORM_NOT_SUPPORTED"` / `"OS_PLUG_GLOC_0003"` instead of `ERROR_CODES.*`
  (`harness/architecture.md`: codes live only in `lib/errors/errorCodes.js`).
- **Test:** `CustomPointsDialog.test.js` → "the failure message is translated" and
  `OnboardingWizard.test.js` → "the failure messages are translated" (`it.fails`); the `alt` has
  none.
- **Fix:** new `errors:`/`ui:` keys in all four locales (`ru`, `en`, `pl`, `uz`), used via
  `$i18n.t(...)`; `ERROR_CODES.*` for the two comparisons. Checked: translating the toasts flips
  both pinned tests, the rest stays green.

## BUG-23 · `withTabbar` without a returned cleanup in screens — open

- **Where:** `src/views/Settings/Settings.svelte`, `src/views/About/About.svelte`,
  `src/views/More/More.svelte`, `src/views/TechnicalInfo/TechnicalInfo.svelte`,
  `src/views/Map/Map.svelte` (`$effect(() => { withTabbar({...}) })`)
- **What:** `harness/screens.md` requires every screen to `return` the dispose function of
  `withNavbar`/`withTabbar` from its `$effect`; these effects drop it, so the tabbar keeps the
  leaving screen's config. No visible bug today only because every screen that needs the tabbar
  sets it again on entry (`Handbook` doesn't set it at all and relies on that).
- **Test:** `src/views/Settings/Settings.test.js` → "gives the tabbar back when it goes away"
  (`it.fails`); the other screens have no test yet.
- **Fix:** `$effect(() => withTabbar({...}))` (return the dispose) in each of them; check that
  `Handbook` then gets the default (visible) tabbar — it does, `reset()` restores the defaults.

## BUG-24 · The Handbook category restore overwrites the user's pick — open

- **Where:** `src/components/Filters/SortingByCategories.svelte` (`onMount`)
- **What:** same race as BUG-6/BUG-9: the saved category is read in the background and applied
  when it arrives; a category picked before that is overwritten — with "all" when nothing was
  saved. Low impact (one Preferences round-trip after the side panel renders).
- **Test:** `src/components/Filters/SortingByCategories.test.js` → "a category picked before the
  restore finished is kept" (`it.fails`).
- **Fix:** an `isPickedByUser` flag set in `select()`; `onMount` returns early when it is set.
  Checked: flips the pinned test, the rest stays green. Worth fixing BUG-6, BUG-9 and this one
  the same way in one change.

## BUG-25 · Leaving the map while it loads leaks a whole map — open

- **Where:** `src/views/Map/Map.svelte` (`onMount` async chain vs `onDestroy`)
- **What:** `onMount` awaits the PMTiles download (megabytes — seconds on a weak phone) and
  `customPointsState.ready`. If the user leaves the map screen meanwhile, `onDestroy` runs while
  `map` is still `null` and cleans up nothing; then `onMount` resumes and creates a MapLibre map
  (a WebGL context) on the detached container, the builders, the controllers and a theme
  subscription — none of them ever released. Browsers cap WebGL contexts, so a few quick
  map ↔ handbook switches during loading can end with a map that no longer starts.
- **Test:** `src/views/Map/Map.test.js` → "leaving while the tiles load does not create a map
  afterwards" (`it.fails`).
- **Fix:** an `isDestroyed` flag set in `onDestroy`; after every `await` in `onMount`, if it is
  set, release what was created so far (e.g. `cleanupMap` with the protocol) and return.
  Checked: an early return after the PMTiles await flips the pinned test.

## BUG-26 · Android back ignores the open side panel and the marker editor — open, needs a decision

- **Where:** `src/App.svelte` (`<Panel>` driven by `lib/state/panel.svelte.js`) and
  `src/components/CustomPoints/CustomPointsMapEditorDialog.svelte` (`<Sheet>`)
- **What:** neither is on the overlay stack (`createToggleOverlay`/`useOverlay`), so the hardware
  back button skips them: with the filters panel open on the map, back shows the exit toast /
  minimizes; with the editor open, back leaves the screen (`Map.svelte` is destroyed; the new
  point's photos stay on disk until the next startup check removes them). `harness/state-management.md`
  says an overlay that should close on back uses `createToggleOverlay`; `NavigationSheet` is
  documented as deliberately not registered — these two are not documented either way.
- **Test:** none yet — decide the intended behavior first.
- **Fix (if wanted):** register the panel in `panel.svelte.js` (`openPanel` → `useOverlay().open`,
  `closePanel` → `close`), and the editor through the map screen's edit-mode controller; the
  editor's back should behave like its cancel (`photoSession.discard()`).

## BUG-27 · A failed bootstrap leaves the app on the native splash for good — open

- **Where:** `src/main.js` (`bootstrap()`)
- **What:** `capacitor.config.json` has `launchAutoHide: false`, so only `bootstrap()` hides the
  native splash — as its last step, with no error handling. Anything that throws on the way
  (`CapApp.getInfo()`, the theme init, mounting) leaves the user on the splash with no way out.
  Also: `CapApp.getInfo()` is called twice on a device (two bridge calls for one answer,
  `harness/performance.md`).
- **Test:** none: the failure is an unhandled promise rejection, which Vitest reports as an error
  of the whole run (so it can't be pinned with `it.fails`). `src/main.test.js` covers the
  normal path; add the failure-path test together with the fix.
- **Fix:** call `getInfo()` once; wrap the body in `try`/`catch` (fall back to the build's
  `__APP_NAME__`/`__APP_VERSION__`, log the error) and hide the splash in `finally`.
