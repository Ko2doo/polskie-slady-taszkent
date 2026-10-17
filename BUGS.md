# Known bugs

Working log of bugs found while covering the project with tests. Lifecycle and rules:
`harness/testing.md` → "Bug log". Temporary: deleted once every entry is fixed and the fix
summary has been handed over for the commit.

Status: `open` (pinned by an `it.fails` test, code untouched) → `fixed` (code fixed, `.fails`
removed, suite green, a **Fixed:** line saying what changed — the source for the final commit
message).

## BUG-1 · `getRawPathFromRoute` crashes on a missing route result — fixed

- **Where:** `src/utils/routerUtils.js:8`
- **What:** `if (!result) '';` is missing `return`, so `undefined`/`null` falls through to
  `result.path` and throws a `TypeError`. Map, Handbook, Settings and About call
  `resolvePageKeyFromRouteResult(route?.result)`, which can be `undefined`.
- **Test:** `src/utils/routerUtils.test.js` → "returns an empty string for a missing result"
  (`it.fails`).
- **Fix:** `if (!result) return '';`
- **Seen for real:** mounting `Handbook` with a `route` that has no `result` crashes on this
  (found while writing `Handbook.test.js`).
- **Fixed (2026-10-17):** `if (!result) return '';`. Callers (`resolvePageKeyFromRouteResult`
  in Map, Handbook, Settings, About) now get the empty-path page key instead of a TypeError.
  `.fails` removed.

## BUG-2 · `InMemoryPMTilesSource` ignores the offset of a `Uint8Array` view — fixed

- **Where:** `src/utils/inMemoryPmtilesSource.js` (constructor)
- **What:** a `Uint8Array` is stored as `data.buffer`, ignoring `byteOffset`/`byteLength`,
  so a subarray serves bytes from the wrong position. Latent: the app passes an
  `ArrayBuffer` today.
- **Test:** `src/utils/inMemoryPmtilesSource.test.js` → "respects the byteOffset of a
  Uint8Array view" (`it.fails`).
- **Fix:** `data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)`; also
  rename the `lenght` parameter of `getBytes` to `length`.
- **Fixed (2026-10-17):** not with the proposed `buffer.slice` (a full copy of a megabytes
  archive in RAM, `harness/performance.md`): the source keeps a `Uint8Array` view — the given
  one as is, or `new Uint8Array(arrayBuffer)` — and `getBytes` copies only the requested range
  (`view.slice(...).buffer`), which respects the view's offset and end. `lenght` → `length`.
  Non-regression: the app's path (an `ArrayBuffer`) and the "returns a copy" / "clamps past the
  end" tests unchanged and green. `.fails` removed; new test: a range can't run past the end of
  a view into the rest of its buffer. Mutation-checked.

## BUG-3 · Dead import in `More.svelte` — fixed

- **Where:** `src/views/More/More.svelte:7`
- **What:** `resolvePageKeyFromRouteResult` is imported but never used (dead code, see
  `harness/code-style.md`). No behavior impact.
- **Test:** none (no behavior to test).
- **Fix:** remove the import.
- **Fixed (2026-10-17):** import removed.

## BUG-4 · A cached route in the opposite direction starts at the wrong end — fixed

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
- **Fixed (2026-10-17):** the proposed fix turned out invalid — the shipped graph is *not*
  two-way (32 053 of 314 479 edges have no reverse, see BUG-29) and the engine follows edge
  direction, so A→B reversed can use an edge against its direction. Decision: the cache key
  keeps the direction (`getCacheKey` no longer sorts), A→B and B→A are separate entries and
  B→A is the engine's own answer. Cost: the way back is searched once more, then cached.
  Non-regression: `findRoute` callers (manual and GPS navigation) get exactly what the engine
  returns; LRU/size logic unchanged. `.fails` removed; tests that pinned the old shared entry
  ("serves the opposite direction…", "stores and finds … both directions", "caching the same
  pair again…") rewritten for the new contract. Mutation-checked (sorted key back → 3 fail).
  `harness/navigation-subsystem.md` and the module's JSDoc updated.

## BUG-5 · Dead commented-out code in `NavigationEngine` — fixed

- **Where:** `src/services/navigation.js` (constructor)
- **What:** the old adjacency/integrity-check implementation is left commented out above
  the current one (dead code, see `harness/code-style.md`). No behavior impact.
- **Test:** none (no behavior to test).
- **Fix:** delete the commented-out block.
- **Fixed (2026-10-17):** block deleted (and the "in on pass" typo in the comment below it).

## BUG-6 · The map filter restore can overwrite the user's pick — fixed

- **Where:** `src/lib/state/mapMarkerFilter.svelte.js` (`hydrate`)
- **What:** the saved filter is restored in the background; if the user picks a filter
  before the read finishes, the restore overwrites the pick in memory (the storage keeps the
  user's value, so the screen and the storage disagree until the next pick). Low impact: on a
  device the window is one Preferences bridge round-trip at app start.
- **Test:** `src/lib/state/mapMarkerFilter.test.js` → "a filter picked before the restore
  finished is kept" (`it.fails`).
- **Fix:** set a module-level `isPickedByUser = true` in `select()`, and return early from
  `hydrate()` when it is set.
- **Fixed (2026-10-17, with BUG-9 and BUG-24 — same race, same fix):** `isPickedByUser` is set
  in `select()` only on a real change (re-picking the current filter saves nothing, so the
  saved one must still be restored — screen and storage would disagree otherwise); `hydrate()`
  returns after its read when it is set. `.fails` removed; new test: re-picking the current
  filter doesn't block the restore. Mutation-checked (no guard; flag set before the equality
  check).

## BUG-7 · Swapped debug log messages in `customPointsDialogState` — fixed

- **Where:** `src/lib/state/customPointsDialogState.svelte.js` (`load`)
- **What:** `seen = true` logs "showing dialog", `seen = false` logs "already seen - hiding
  dialog" — the opposite of what happens. Debug output only; no behavior impact.
- **Test:** none (no behavior to test).
- **Fix:** swap the two messages.
- **Fixed (2026-10-17):** `load()` reduced to `seen = (await getStorage(KEY)) === true` with one
  correct log line; its unreachable `catch` (BUG-8 leftover) removed — same behavior, tests green.

## BUG-8 · `markCompleted` can never report a failed save — fixed

- **Where:** `src/lib/state/customPointsDialogState.svelte.js` (`markCompleted`)
- **What:** undesired behavior rather than a crash. `markCompleted` wraps `setStorage` in
  try/catch and re-throws, but `setStorage` (`capacitor/utils/appStorage.js`) swallows every
  error itself, so the `catch` is dead and `seen` becomes `true` even when nothing was saved —
  the intro dialog silently shows again on the next launch.
- **Decision (2026-10-17):** report it — `setStorage` returns `true`/`false`; callers that
  set a flag only after a successful save check it.
- **Test:** none yet — add with the fix.
- **Fix:** either make the caller able to see the failure (e.g. `setStorage` returning a
  boolean, checked here) or drop the dead try/catch and document that it's best-effort.
- **Same pattern:** `src/store/appStartInitialize.js` — the `catch` blocks of `initFirstLaunch`
  and `markFirstLaunchCompleted` are dead for the same reason (`getStorage`/`setStorage` never
  throw). `initFirstLaunch` still behaves right (a failed read returns `null` → onboarding
  shown); `markFirstLaunchCompleted` hides the wizard even when the flag wasn't saved, so the
  onboarding shows again on the next launch. Fix both together.
- **Fixed (2026-10-17, with BUG-12):** `setStorage` returns `true`/`false` (still never throws).
  `markCompleted` and `markFirstLaunchCompleted` set their flag only when it was saved and
  throw otherwise — which is what their callers were already written for: `CustomPointsDialog`
  and the onboarding wizard catch it, show "try again" and stay open. Non-regression: the other
  `setStorage` callers (theme, language, map filter, layout, category) ignore the result, as
  before. New tests: a failed save throws and leaves the flag unset (both modules), `true`/`false`
  results. Mutation-checked. Left for the dead-code step: the read-side `catch` blocks in
  `load()`/`initFirstLaunch()` (`getStorage` never throws). The toast text itself is BUG-22.

## BUG-9 · The Handbook layout restore reverts the user's pick — fixed

- **Where:** `src/store/ui/layoutView.js` (`hydrate`)
- **What:** same race as BUG-6, worse: if the user switches to rows before the background
  read finishes, the restore resets the layout — even with nothing saved, it maps `null` to
  grid and overwrites the pick. Low impact: the window is one Preferences round-trip at
  startup.
- **Test:** `src/store/ui/layoutView.test.js` → "a layout picked before the restore finished
  is kept" (`it.fails`).
- **Fix:** `let isPickedByUser = false`, set it in `set()`, return early from `hydrate()`
  when it's set (same fix as BUG-6).
- **Fixed (2026-10-17, with BUG-6):** same as BUG-6 in `layoutView.set()` / `hydrate()`.
  `.fails` removed; new test: re-picking the current layout doesn't block the restore.

## BUG-10 · Hard-coded English fallback labels in `errorToast` — fixed

- **Where:** `src/store/ui/errorToast.js` (`ACTION_LABELS`, `sanitizeAction`)
- **What:** an action without a `label` gets `'Open Settings'` / `'Retry'` / `'Action'` —
  user-visible text outside i18next (`harness/i18n.md`). Latent: every current caller passes
  a translated `label`.
- **Test:** none (the fix decides the contract; the current test only checks a label exists).
- **Fix:** make `label` required (drop the action with a debug warning when missing), or take
  the fallbacks from `ui:buttons:*` keys in all four locales.
- **Fixed (2026-10-17):** `label` is required: `sanitizeAction` drops an action whose label isn't
  a non-empty string (debug warning), the toast itself still shows; `ACTION_LABELS` and the
  `'Action'` default removed, JSDoc example uses `i18n.t('ui:buttons:openSettings')`. All three
  callers already pass a translated label. Tests: the "gets a non-empty label" test (which pinned
  the English fallback) replaced by "an action without a usable label is dropped" (undefined,
  '', blanks, a number). Mutation-checked. Not touched: `normalizeError`'s `'Unknown error'`
  fallbacks — only reachable if a caller passes a raw error instead of a translated text, which
  no caller does.

## BUG-11 · Dead `'added'` binding in `translationStore` — fixed

- **Where:** `src/store/i18nextSvelte/translationStore.js` (`bindOnChange`)
- **What:** `i18n.on('added', ...)` never fires: i18next emits `added` on `i18next.store`,
  not on the instance. No impact today (resources are bundled statically, nothing adds them at
  runtime), but a future `addResourceBundle` wouldn't re-render `$i18n`.
- **Test:** none (no current behavior depends on it).
- **Fix:** `i18n.store.on('added', setupI18n)`, or drop the binding if runtime resources are
  never planned.
- **Fixed (2026-10-17):** binding dropped — resources are bundled statically, nothing adds them
  at runtime.

## BUG-12 · `setStorage`/`getStorage` change the type of a JSON-looking string — fixed

- **Where:** `src/capacitor/utils/appStorage.js`
- **What:** non-objects are stored with `String(value)` but always read back with
  `JSON.parse`, so `setStorage(k, '42')` reads back `42`, `'true'` → `true`, `'null'` → `null`.
  Latent: every current key holds a word (`'en'`, `'all'`, `'layoutRows'`) or a real boolean.
- **Test:** `src/capacitor/utils/appStorage.test.js` → "a string that looks like JSON comes
  back as a string" (`it.fails`).
- **Fix:** serialize every value with `JSON.stringify`. Backwards compatible: values saved
  earlier as raw text (`en`) still fail `JSON.parse` and come back as the raw string. Checked:
  with this fix the rest of the suite stays green.
- **Fixed (2026-10-17, with BUG-8):** every value goes through `JSON.stringify(value ?? null)`.
  Compatibility checked both ways: values saved by older versions (`en`, `layoutRows`, `true`)
  read back exactly as before (tests), and a rolled-back older version reads the new `"en"`
  through its own `JSON.parse` fine. All current keys hold words or `true`, so no stored value
  changes meaning. `.fails` removed; new tests for '42'/'true'/'null'/'{"a":1}' as strings.

## BUG-13 · Native geolocation error codes are never recognized — fixed

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
- **Fixed (2026-10-17):** `mapGeolocationError` normalizes a string code (`-` → `_`) and
  accepts it only if `ERROR_CODES` knows it — an unknown one (the plugin's 0018, manifest
  misconfiguration, has no translation) still goes to the message rules / generic 0002 instead
  of reaching a toast as a raw key. Unreachable "Priority 2" removed. `.fails` removed from both
  tests; new tests: native 0017 (mapper + `isLocationServicesEnabled`), unknown native/app code,
  another plugin's code. Non-regression: consumers are `requestLocationPermission`,
  `isLocationServicesEnabled` (→ `checkLocationReadiness`, used by no screen), `gpsTracker` →
  `MapNavigationGPS.handleGPSError`, which handles every known code and all have translations
  in the four locales. On a device: GPS off now shows the "turn on location services" toast.

## BUG-14 · Route progress is not reset after an off-route recalculation — fixed

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
- **Fixed (2026-10-17):** `displayRoute()` calls `gpsTracker?.resetRoute()` — every new route,
  whatever triggered it, starts the tracker's progress from 0. Chosen over resetting before the
  calculation: a failed recalculation keeps the old route on screen, and its progress stays
  valid. Non-regression: `displayRoute` is only called by `calculateRouteFromGPS`; `resetRoute`
  only zeroes the window index. `.fails` removed; the test now also checks the reset comes
  after the new route, plus a test that a failed recalculation keeps the progress. Both
  checked by mutation (no reset; reset before calculating).

## BUG-15 · Attribute injection (XSS) in the map popup — fixed — security

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
- **Fixed (2026-10-17):** `escapeHtml` now also escapes `"` → `&quot;` and `'` → `&#39;`;
  `.fails` removed, plus unit tests for quotes and single escaping of `&`. Checked the other
  raw-HTML spots (`innerHTML`, `{@html}`): they only insert static or translation markup.
  Non-regression: `escapeHtml` is only used by `createPopupHTML` → both builders, which insert
  via `innerHTML` (entities decode back) and take the clicked id from a closure; new test
  "an ordinary title with quotes shows unchanged" (e.g. Uzbek `o'`).

## BUG-16 · The map popup preview never releases its photo url (web build) — fixed

- **Where:** `src/views/Map/MapPreview.js` (`resolvePreview`) / `Map.svelte` (`refreshPreview`)
- **What:** `getPhotoUrl()` takes one reference of a reference-counted Blob url on the web, and
  nothing calls `releasePhotoUrl()` for it; every refresh takes another one. The Blob urls of
  covers are never revoked while the app runs. Web/dev build only — on a device the url is a
  plain `convertFileSrc` string with nothing to release.
- **Test:** none yet (needs `Map.svelte`-level coverage).
- **Fix:** keep the previous preview path per point in `Map.svelte` and `releasePhotoUrl()` it
  when the preview is replaced, the point is removed, or the map is destroyed.
- **Fixed (2026-10-17):** `MapPreview.js` → `createPreviewTracker()` (`resolve`/`release`/
  `releaseAll`) remembers the cover path each popup holds; `resolve` takes the new reference
  *before* giving the old one back, so an unchanged cover isn't revoked and read again.
  `Map.svelte` uses it for the saved points' previews and `refreshPreview`, releases a deleted
  point's, and everything in `releaseMapResources()`. Non-regression: `deletePhotoFiles` also
  releases a deleted photo's url; a later release then finds no entry and does nothing. On a
  device `releasePhotoUrl` is a no-op (no Blob urls). Tests: the tracker against a
  reference-count model of the photo cache, plus `Map.test.js` (delete, unmount). Five
  mutations each caught.

## BUG-17 · Leftover dead code in map modules — fixed

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
- **Fixed (2026-10-17):** all removed: the `maplibre-gl` comment in `MapEditMode`, `current` in
  `routerBack`, the attribution comments in `mapStyle` (attribution itself is the map's
  `AttributionControl`), `handleBack`/`routerBack` import and the commented lines (plus the
  orphaned `svelte-ignore` above them) in `Article.svelte`, `dialogState` in
  `CustomPointsDialog`, and the never-shown `text` of all four `NavbarBackLink`s.

## BUG-18 · Turning GPS mode off keeps the position watch running — fixed

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
- **Fixed (2026-10-17):** new `stopGPSTracking()` (stop + forget the tracker, `gpsReady = false`)
  runs when GPS mode is switched off and in `dispose()`. Not in `clearGPSNavigation()` — that one
  is also "clear the destination" (`onGPSClear`, arrival, out-of-bounds) with GPS mode staying on.
  While `initGPS` is still starting, the off-switch leaves the tracker to it: `initGPS` keeps its
  own reference and, after each `await`, stops it if the mode went off (`stopIfSwitchedOff`) —
  so a quick off → on doesn't end with a dead tracker, and leaving the map screen during the
  start (e.g. during the permission prompt) doesn't leak the watch. `.fails` removed; new
  tests: on again → fresh watch, clearing the destination keeps tracking, off / quick off → on /
  `dispose` while the watch is starting. Each part checked by reverting it.

## BUG-19 · Cancelling "new destination?" still switches the destination — fixed

- **Where:** `src/views/Map/MapNavigationGPS.svelte.js` (`handleMapClick`, `closeDialog`)
- **What:** a click while navigating writes the new `destinationPoint` before asking; the
  dialog's cancel only closes the dialog. The old route stays on screen, but arrival and the
  next off-route recalculation already head to the new point. (Manual mode is fine: it doesn't
  touch its points until confirmed.)
- **Test:** `src/views/Map/MapNavigationGPS.test.js` → "cancelling keeps heading to the old
  destination" (`it.fails`).
- **Fix:** keep the click in a `pendingDestination`; `confirmNewDestination()` moves it into
  `destinationPoint`, cancel drops it. Checked: flips the pinned test, the rest stays green.
- **Fixed (2026-10-17):** a click while navigating goes to `pendingDestination`;
  `confirmNewDestination()` moves it into `destinationPoint`, `closeDialog()` (cancel) and
  `clearGPSNavigation()` drop it. Non-regression: the dialog is wired in `Map.svelte` through
  `activeNav.closeDialog/confirmNewDestination` only; manual mode has its own controller and is
  untouched; the existing "confirming builds the route to the new place" test stays green.
  `.fails` removed; new tests: after cancel, arrival is still tied to the old destination, and a
  cancelled place isn't picked up by a later confirmation. Mutation-checked (writing before
  asking, confirm ignoring the pending place, cancel keeping it).

## BUG-20 · A theme switch during GPS navigation drops the route line — fixed

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
- **Fixed (2026-10-17, with BUG-21):** `createThemeController` takes an optional
  `getCurrentRoute` (default: the manual navigation's route, as before); `Map.svelte` passes
  `navigation?.currentRoute ?? gpsNavigation?.currentRoute`, so the manual route is restored
  exactly as before and the GPS one too. Non-regression: `createThemeController` is only called
  by `Map.svelte`; the existing "restores … route and nav markers" test (default path) stays
  green. New tests: `MapTheme.test.js` → "restores the route given by getCurrentRoute", and
  `Map.test.js` → "a theme switch redraws the GPS route as well as the manual one".
  Mutation-checked (Map passes nothing; the controller ignores the getter).

## BUG-21 · Theme listeners leak on every map visit and quick switch — fixed

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
- **Fixed (2026-10-17, with BUG-20):** (1) `Map.svelte` calls `theme.dispose()` on the map-less
  step-2 controller before replacing it (creating it once and handing it the map later is left
  to the `Map.svelte` refactoring step); (2) `onIdle` unsubscribes itself first, so an outdated
  one goes too. Both `.fails` removed; the Map test also checks that the live controller is not
  disposed. Mutation-checked (no dispose; `off` back after the version check).

## BUG-22 · Hard-coded English user-visible text — fixed

- **Where:**
  - `src/components/CustomPoints/CustomPointsDialog.svelte` (`dialogCompleted`): toast
    `"Failed to save settings. Please try again."`
  - `src/views/OnboardingWizard/OnboardingWizard.svelte`: toasts `"Failed to request location
    permission"` (`handleRequestPermission`) and `"Failed to save settings. Please try again."`
    (`completeOnboarding`); `alt="App logotype"` on the logo.
- **What:** user-visible text (and an `alt`) outside i18next (`harness/i18n.md`), English in every
  language. Related cleanup in the onboarding: it compares `err.code` with the literal strings
  `"WEB_PLATFORM_NOT_SUPPORTED"` / `"OS_PLUG_GLOC_0003"` instead of `ERROR_CODES.*`
  (`harness/architecture.md`: codes live only in `lib/errors/errorCodes.js`) — the native-code
  part of that is tracked as BUG-28.
- **Test:** `CustomPointsDialog.test.js` → "the failure message is translated" and
  `OnboardingWizard.test.js` → "the failure messages are translated" (`it.fails`); the `alt` has
  none.
- **Fix:** new `errors:`/`ui:` keys in all four locales (`ru`, `en`, `pl`, `uz`), used via
  `$i18n.t(...)`; `ERROR_CODES.*` for the two comparisons. Checked: translating the toasts flips
  both pinned tests, the rest stays green.
- **Fixed (2026-10-17):** new keys in all four locales — `errors:settingsSaveFailed`,
  `errors:locationPermissionRequestFailed`, `ui:dialog:onboarding:logoAlt` — used in
  `CustomPointsDialog` and `OnboardingWizard`; `"WEB_PLATFORM_NOT_SUPPORTED"` →
  `ERROR_CODES.WEB_PLATFORM_NOT_SUPPORTED`. Locale parity test green. `.fails` removed from both
  tests, which now check the exact keys; new test for the logo's `alt`.

## BUG-23 · `withTabbar` without a returned cleanup in screens — fixed

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
- **Fixed (2026-10-17, widened on request — the tab bar must come back after the More
  sub-screens, the onboarding, a reload):** the proposed fix (return the dispose) still leaves
  a shared "last writer wins" field, whose result depends on the order screens mount/unmount
  in. `bottomTabbarNav.svelte.js` now counts hide requests: `hideTabbar(slide)` returns a
  release, the tab bar is visible when none is held. Users: `AppSplash` (slides in 400/350 once
  it goes — replaces `App.svelte`'s `APP_READY` effect), Settings/About/Technical Info, the map's
  edit mode, and — new — the onboarding wizard while open. More/Map/Handbook do nothing (More's
  workaround removed). The count is read under `untrack` (screens' `$effect`s would otherwise
  subscribe to and loop on each other's requests — mutation: 27 tests fail), floored at 0, and a
  release is idempotent. `setTabbar`/`patchTabbar`/`withTabbar` removed, unused `resetTabbar`
  import dropped from `App.svelte`. Also: back from a More sub-screen falls back to `/more`,
  not `/` (after a reload the in-memory history is empty and back went to the map).
  Verified in headless Chrome against the dev server (More ↔ Settings/About/Technical Info,
  F5 then app back / browser back, a language/theme change before F5, a fresh onboarding):
  the tab bar is there every time. The exact device symptom wasn't reproduced; the order
  dependence it most likely came from no longer exists. Tests: `bottomTabbarNav.svelte.test.js`
  (rewritten), `AppSplash.test.js` (new), Map edit mode, onboarding, Settings back target and
  cleanup (`.fails` removed); each release path mutation-checked.

## BUG-24 · The Handbook category restore overwrites the user's pick — fixed

- **Where:** `src/components/Filters/SortingByCategories.svelte` (`onMount`)
- **What:** same race as BUG-6/BUG-9: the saved category is read in the background and applied
  when it arrives; a category picked before that is overwritten — with "all" when nothing was
  saved. Low impact (one Preferences round-trip after the side panel renders).
- **Test:** `src/components/Filters/SortingByCategories.test.js` → "a category picked before the
  restore finished is kept" (`it.fails`).
- **Fix:** an `isPickedByUser` flag set in `select()`; `onMount` returns early when it is set.
  Checked: flips the pinned test, the rest stays green. Worth fixing BUG-6, BUG-9 and this one
  the same way in one change.
- **Fixed (2026-10-17, with BUG-6):** `select()` sets `isPickedByUser`, `onMount` returns after
  its read when it is set. Unconditionally here: a radio only fires when it becomes checked, so
  every `select()` is a real change. The `$effect` fallback to "all" (category gone) doesn't go
  through `select()`, so it isn't taken for a pick. `.fails` removed.

## BUG-25 · Leaving the map while it loads leaks a whole map — fixed

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
- **Fixed (2026-10-17):** `onDestroy`'s body became `releaseMapResources()`; `onDestroy` sets
  `isDestroyed` and calls it, and `onMount` checks the flag at the two points that matter —
  before creating the map (covers the tiles and style awaits) and after the saved points'
  previews (covers `customPointsState.ready`) — releasing what it created and returning.
  Non-regression: the `pmtiles` protocol is global, and the late release of a left screen could
  have removed it from under the next, already-mounted map — so `MapLifecycle` now
  reference-counts it (`protocolUsers`): only the last cleanup calls `removeProtocol`.
  `.fails` removed; new tests: leaving during the points load stops the start (no `load`
  handler, no second theme controller), the protocol survives while another screen uses it.
  Each check and the ref-count verified by reverting it (two more checks first added turned
  out redundant and were dropped).

## BUG-26 · Android back ignores the open side panel and the marker editor — fixed

- **Where:** `src/App.svelte` (`<Panel>` driven by `lib/state/panel.svelte.js`) and
  `src/components/CustomPoints/CustomPointsMapEditorDialog.svelte` (`<Sheet>`)
- **What:** neither is on the overlay stack (`createToggleOverlay`/`useOverlay`), so the hardware
  back button skips them: with the filters panel open on the map, back shows the exit toast /
  minimizes; with the editor open, back leaves the screen (`Map.svelte` is destroyed; the new
  point's photos stay on disk until the next startup check removes them). `harness/state-management.md`
  says an overlay that should close on back uses `createToggleOverlay`; `NavigationSheet` is
  documented as deliberately not registered — these two are not documented either way.
- **Decision (2026-10-17):** yes, both close on Android back; the editor's back = its cancel.
- **Test:** none yet — add with the fix.
- **Fix:** register the panel in `panel.svelte.js` (`openPanel` → `useOverlay().open`,
  `closePanel` → `close`), and the editor through the map screen's edit-mode controller; the
  editor's back should behave like its cancel (`photoSession.discard()`).
- **Fixed (2026-10-17):** the panel: `panel.svelte.js` registers with `overlayController` while
  `isOpen` and unregisters on every way it closes (`closePanel`, `setPanel`/`patchPanel`
  with `false`, `resetPanel` — also the `withPanel` cleanup of a screen) — works on the map
  and in the Handbook. The editor registers itself in an `$effect` on `opened` (cleanup
  unregisters on close *and* when the map screen goes away with it open); back closes the
  photo-source menu, then the delete question, then the editor as cancel (`handleClose` →
  `photoSession.discard()`). Not through the edit-mode controller as first proposed: the photo
  session lives in the dialog. Non-regression: `backButton.js`/`overlayController`/router
  untouched, their tests green; layers opened on top (article popup, photo viewer) register
  later and still close first (LIFO). New tests in `panel.test.js` and
  `CustomPointsMapEditorDialog.test.js`; six mutations each caught.

## BUG-27 · A failed bootstrap leaves the app on the native splash for good — fixed

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
- **Fixed (2026-10-17):** `bootstrap()` split into `initTheme()` (failure → default theme) and
  `resolveAppInfo()` (one `getInfo()` call; failure → the build's name/version); mounting is in
  `try`/`catch`, and `SplashScreen.hide()` runs in `finally` (its own failure is logged, not
  thrown). Non-regression: the normal order theme → mount → splash is unchanged (existing test).
  New tests: one `getInfo` call; `getInfo`, theme init or mount failing still ends with the
  splash hidden. Mutation-checked: without the fallbacks a test fails; without the catch the run
  reports an unhandled rejection (fails CI).

## BUG-28 · Native error-code literals outside `errorCodes.js` — fixed

- **Where:**
  - `src/views/OnboardingWizard/OnboardingWizard.svelte:51,53,79` — `"errors:OS_PLUG_GLOC_0003"`,
    `code: "OS_PLUG_GLOC_0003"`, `err.code === "OS_PLUG_GLOC_0003"`
  - `src/capacitor/services/locationPermission.js:326` (`mapGeolocationError`) and
    `src/views/Map/MapNavigationGPS.svelte.js:355` — the `'OS_PLUG_GLOC_'` prefix as a literal
- **What:** breaks the `harness/architecture.md` rule (native codes only in
  `lib/errors/errorCodes.js`). Not a runtime failure today, but a code renamed or re-shaped in
  `errorCodes.js` (exactly what BUG-13 needs: the plugin reports `OS-PLUG-GLOC-*`) silently
  leaves these behind.
- **Test:** `src/lib/errors/errorCodes.test.js` → "appear only in lib/errors/errorCodes.js"
  (`it.fails`) — scans all app code (not `locales/`, `test/`, tests, comments).
- **Fix:** use `ERROR_CODES.OS_PLUG_GLOC_0003` (and `` `errors:${ERROR_CODES.…}` `` for the i18n
  key); export the geolocation prefix from `errorCodes.js` (e.g. `GEOLOCATION_CODE_PREFIX`) and
  import it in both places. Do it together with BUG-13 (same mapper line).
- **Fixed (2026-10-17, with BUG-13):** `errorCodes.js` exports `GEOLOCATION_CODE_PREFIX`, used by
  `locationPermission.js` and `MapNavigationGPS.svelte.js`; the onboarding uses
  `ERROR_CODES.OS_PLUG_GLOC_0003` (also inside the i18n key). `.fails` removed; the scanner no
  longer takes a constant inside a template string (`${ERROR_CODES.OS_PLUG_…}`) for a literal.

## BUG-29 · The navigation graph forbids walking against one-way traffic — fixed

- **Where:** `scripts/navigationGraph/build-navigation-graph.mjs:71` (`oneway`), shipped data
  `public/map/navigation-graph-optimized.json`
- **What:** the build treats OSM `oneway=yes` as one-way for the pedestrian graph and adds no
  reverse edge. In OSM `oneway=yes` on a road applies to vehicles; a pedestrian may walk both
  ways unless `oneway:foot=yes` says otherwise (and `highway=footway`/`steps` with
  `oneway=yes` is rare and meant literally). Result: 32 053 of 314 479 shipped edges (~10%) have
  no reverse, so routes on foot make detours instead of walking back along a one-way street,
  and A→B / B→A routes differ (why BUG-4 had to cache per direction).
- **Test:** none in `src/` (the scripts are dev tools). Measured with a one-off count of edges
  without a reverse over the shipped JSON.
- **Fix:** in the build script, one-way for pedestrians only when `oneway:foot` is `yes`, or
  `oneway=yes` on `footway`/`path`/`steps`/`pedestrian` (also handle `oneway=-1`, reversed);
  then regenerate the graph from the tracked `scripts/overpass/tashkent_roads.geojson` (steps
  3, 4, 6 in `harness/map-data-pipeline.md` — no network needed) and add a test in
  `navigation.test.js` that the shipped graph has (almost) every edge both ways.
  `scripts/` is hands-off: needs an explicit go-ahead.
- **Fixed (2026-10-17, go-ahead for `scripts/` given):** `build-navigation-graph.mjs` decides
  the direction per way with `pedestrianDirection()` (rule above, `oneway=-1` reversed); graph
  rebuilt from the tracked `tashkent_roads.geojson` (no new download — the data has no
  `oneway:foot` at all, only the rule was wrong), optimized and copied to `public/map/`.
  Measured against the old graph: edges without a reverse 32 053 → 16 (the 10 tagged
  footway/pedestrian ways); pairs of historical places with **no route** 12/156 → 0; 127
  pairs shorter (avg −62 m, max −251 m), 7 longer by 1–58 m (more chain nodes contracted);
  A→B ≠ B→A 86 → 0; snap-to-node distance unchanged (p95 97 m, limit 1000 m); search time
  ~2.3 ms; file 27.37 → 27.69 MB (+1.2%, loaded lazily). New tests in `navigation.test.js`
  ("walkable both ways", "connects every historical place…") fail on the old graph. The
  `.pmtiles` extract is unrelated (display only) and was not touched. The per-direction route
  cache (BUG-4) stays: still correct, and the 16 one-way edges are real.

## BUG-30 · Hard-coded English in More and the splash — fixed

- **Where:** `src/views/More/More.svelte` (`App Version: {version}`, `Powered by`,
  `alt="Project logo"`), `src/AppSplash.svelte` (`Version: {version}`, `alt="App logo"`);
  latent: `NavbarBackLink text="Back"` in Settings/About/Technical Info/Article (Konsta doesn't
  render the text at phone width — seen empty in headless Chrome at 412 px — but may on a
  tablet).
- **What:** user-visible text outside i18next (`harness/i18n.md`), English in every language.
  Found while checking the tab bar in the browser.
- **Test:** none yet.
- **Fix:** `ui:` keys in all four locales (`ui:more:appVersion` with `{{version}}`,
  `ui:more:poweredBy`, `ui:more:logoAlt`, `ui:buttons:back`), used via `$i18n.t(...)`; for the
  splash, check that i18n is ready before the splash renders (it is shown while the app
  initializes) or keep the version line language-neutral.
- **Fixed (2026-10-17):** new keys in all four locales — `ui:more:appVersion` (`{{version}}`),
  `ui:more:poweredBy`, `ui:more:logoAlt`, `ui:splash:version` (`{{version}}`),
  `ui:splash:logoAlt` — and the existing `ui:buttons:back` for the four `NavbarBackLink`s.
  (The `NavbarBackLink` texts were then dropped altogether in BUG-17: Konsta's `showText`
  defaults to `false`, so they never render.) `AppSplash` gets `i18n` from `App.svelte`; it's
  ready by then (`capacitor/services/i18n.js`
  initializes with a top-level `await` before `App.svelte` evaluates). English wording kept as
  it was in each place. Tests: More on the real `pl` locale (version line, credits, logo alt),
  the splash's translated texts; locale parity green.
