# Architecture

## Operating context — read this before reaching for a "standard" pattern

This is an **offline, single-user, client-only app**. There is no backend, no accounts, no
multi-tenancy, no server to talk to except static map tiles bundled with the app. A lot of
things that are default-correct in a typical production web app simply don't apply here:

- No auth/session handling, no per-user data isolation, no "what if two users edit the same
  record" concerns — there is exactly one user, on one device, editing their own local data.
- No server-side rate limiting, no API retry/backoff beyond what's reasonable for fetching
  map tiles — most "network" concerns in this app are Capacitor plugin calls (the native
  bridge) and local file I/O, not HTTP.
- No cache-invalidation-across-clients problem — there's one client, always the source of
  truth for its own data.
- "Production-grade" here means: survives a crashed app mid-write, survives a full disk,
  doesn't corrupt data, works fully offline, and is light on a weak phone — **not** "scales
  to many users" or "handles concurrent writers." See `customPointsStorage.js`'s two-slot
  design (`harness/custom-markers-subsystem.md`) for what that actually looks like here.

## Platforms: Android first

The lead developer develops and tests on **Android first**; iOS builds and App Store
releases are done by a separate contributor (see `README.md` → Maintainers). In practice:

- A feature is "done" when it works on Android (and in the web/dev build). Verify Android
  behavior first: Android System WebView quirks, the hardware back button
  (`capacitor/backButton.js`), Android permission flows, low-end Android performance.
- Still never break iOS knowingly. Anything that touches native configuration or
  platform-specific behavior — a new Capacitor plugin, a permission (`AndroidManifest.xml`
  **and** `Info.plist`), safe areas, splash/icons, `ios/` — must say in the step summary
  what the iOS side needs, so it can be handed to the iOS maintainer.
- `Capacitor.getPlatform()` branches: write and test the Android/web paths; an iOS-only
  path is fine to add when needed, but flag it as unverified on a device.

## Stack

Svelte 5 (runes — see `harness/svelte-rules.md`), Vite, Konsta UI (iOS theme) + Tailwind 4
(see `harness/styling.md`), MapLibre GL JS (tiles via PMTiles/@protomaps/basemaps, see
`harness/map-data-pipeline.md`), Capacitor, i18next (four locales — see `harness/i18n.md`).
Tests: Vitest/jsdom/fake-indexeddb (see `harness/testing.md` for current status). Treat exact
versions as whatever `package.json` says.

This file maps `src/`. Everything outside it — native projects, build config, data scripts,
store tooling — is mapped in `harness/repository-layout.md`.

## The app shell

`src/main.js` boots the app: imports `App.css` (the one place third-party library CSS —
`maplibre-gl`, `swiper` — is imported globally, see `harness/performance.md`), initializes
the theme manager (`lib/theme/themeManager.js`) *before* mounting so the first paint is
already in the right theme, resolves the app name/version (from the native `App.getInfo()` on a device, from the
`__APP_NAME__`/`__APP_VERSION__` build globals on the web), then mounts `App.svelte`.
`App.svelte` shows `AppSplash.svelte` until its own `onMount` init finishes
(`APP_READY`), and owns the Konsta `App`/`Page`/`Navbar`/`Panel` shell, the router outlet, the bottom tab bar,
the onboarding wizard, the article popup, and app-wide init (`initFirstLaunch`,
`initBackButtonHandler`, `initCustomPointsPersistence`). Routing is
`@mateothegreat/svelte5-router`, configured in `src/Routes.js` (one `{ path, component }`
entry per screen — see `harness/screens.md` for what each screen actually does).
`src/utils/routerUtils.js` maps a raw route path to a short "page key" string
(`resolvePageKeyFromRouteResult`), used for localization and navbar logic.

## Directory layout (`src/`) — what lives where, and where new code goes

- `capacitor/` — thin wrappers around exactly one Capacitor plugin each: `utils/appFiles.js`
  (Filesystem), `utils/appStorage.js` (Preferences — `setStorage`/`getStorage`, JSON-aware),
  `services/photoPicker.js` (Camera), `services/locationPermission.js` (geolocation
  permission flow, shared by onboarding and GPS tracking), `services/gpsTracker.js`
  (Geolocation watch/distance/route-deviation), `services/i18n.js` (i18next bootstrap +
  language persistence), `backButton.js` (hardware back button → App plugin). **A new native
  capability gets a new file here**, not raw plugin calls scattered through components —
  this is where platform quirks and error-code translation live, so the rest of the app only
  ever sees a clean function.
- `components/` — reusable Svelte components. Grouped by feature area where there's more
  than one related component (`CustomPoints/`, `Navigation/`, `Filters/`); a handful of
  single, broadly-reused components sit directly in `components/` (`Article.svelte` — the
  article/marker popup, universal across historical and custom points;
  `BottomTabbarNav.svelte`; `ErrorHandlerToast.svelte`/`ExitToast.svelte` — render the
  `errorToast`/`toastController` stores; `DarkModeToggler.svelte`, `LangSwitcher.svelte`,
  `SearchBar.svelte`). `Filters/` holds the Handbook's `LayoutSwitcher`/
  `SortingByCategories` and the map side panel's `MapMarkersFilter` (all/custom/historical,
  backed by `lib/state/mapMarkerFilter.svelte.js`). A component used by more than one feature area goes at the top level,
  not duplicated into each area's folder.
- `data/` — static content: `articles.js` (historical places, id like `l01`..`l13`,
  `photos: string[]` relative to `public/`), `about.js` (`technicalInfoMeta` — the About/
  Technical Info screen's content, including third-party links).
- `lib/errors/errorCodes.js` — the **only** place a literal native-plugin error-code string
  is allowed. A new plugin's error code gets added here first (with a comment citing the
  plugin's own docs), imported from there — never `error.code === 'OS-PLUG-XXXX-0000'`
  inline in a service.
- `lib/icons/` — SVG icon components. Check for an existing one before adding a new one; an
  icon that stays unused is a fine thing to remove later, not to keep "just in case."
- `lib/theme/themeManager.js` — the app-wide light/dark theme controller (a plain-JS
  singleton with its own `subscribe`, not runes). See `harness/styling.md`.
- `lib/state/` — Svelte-5-runes state modules. See `harness/state-management.md` — this is
  the single most important directory to understand before writing new state.
- `services/` — business logic with no UI and no single native-plugin call: the custom-
  markers subsystem (`harness/custom-markers-subsystem.md`), the navigation subsystem
  (`harness/navigation-subsystem.md`), map-popup/style building
  (`mapPointsBuilder.js`/`customPointsBuilder.js`/`mapPopupHtml.js`/`mapStyle.js`), and the
  back-button-aware overlay primitive `useOverlay.js`.
- `store/ui/` — small global UI stores: `errorToast.js` (the single user-facing error/
  warning/info channel — use it rather than inventing a new one), `layoutView.js` (Handbook's
  grid/list layout preference), `overlayController.js` (the back-button overlay stack, LIFO).
  `services/toastController.js` is a *different*, single-purpose "press back again to exit"
  countdown toast — despite the similar name, not the same system as `errorToast.js`.
  `store/i18nextSvelte/` wraps `i18next` in the Svelte store contract (genuinely needs it —
  see `harness/svelte-rules.md`). `store/appStartInitialize.js` tracks first launch (drives
  whether the onboarding wizard is shown).
- `utils/` — small, dependency-free, pure-function helpers (`crc32.js`, `uuid.js`,
  `imageResize.js`, `debugMode.js` for the logger, `swiperAction.js`, `portal.js`,
  `routerUtils.js`, `mapLayerVisibility.js`, `inMemoryPmtilesSource.js` — the pmtiles
  `Source` that serves the map archive from RAM, see `harness/map-data-pipeline.md`). If it
  needs Svelte runes, it belongs in
  `lib/state/` instead.
- `views/` — one folder per screen (`About/`, `Handbook/`, `Map/`, `More/`,
  `OnboardingWizard/`, `Settings/`, `TechnicalInfo/`). `views/Map/` is the one screen big
  enough to be split into several supporting modules (builder wiring, lifecycle, theme,
  navigation, edit mode, load progress) — see `harness/screens.md`.
- `locales/` — translations: `<lang>/{ui,errors,articles,about}.js` + `<lang>/index.js`,
  aggregated by `resources.js`; `collections.js` is the language picker's code → name list.
  See `harness/i18n.md`.
- `assets/` — files processed by Vite (bundled, hashed): `assets/icons/app-icon.png`,
  `assets/styles/typography.css`. Static files that must keep a fixed url (map data,
  previews, fonts) go in the root `public/` instead.
- `test/` — test-only code: `setup.js` (Vitest setup) and shared test helpers. Test files
  themselves sit next to the code they test (`*.test.js`). See `harness/testing.md`.
- Root files: `main.js` (boot), `App.svelte` (shell), `AppSplash.svelte` (splash),
  `Routes.js` (route table), `App.css` (global CSS — Tailwind, Konsta theme, third-party
  CSS, design tokens).

### Deciding where a new file goes

1. Svelte component (renders markup)? → `components/<FeatureArea>/`, or a `views/` subfolder
   if it's screen-level.
2. Holds reactive state meant to be shared or to outlive one component, using
   `$state`/`$derived`/`$effect`? → `lib/state/`, suffix `.svelte.js`. See
   `harness/state-management.md` for the function-vs-singleton-vs-class decision.
3. Wraps exactly one native Capacitor plugin? → `capacitor/services/` or `capacitor/utils/`.
4. Business logic with no UI and no direct native-plugin call (file format, storage, popup
   building, pathfinding, validation)? → `services/`.
5. Small, pure, dependency-free helper with no Svelte reactivity involved? → `utils/`.
   A new translation string → `locales/` (all four languages, see `harness/i18n.md`). A new
   static asset with a fixed url (map data, image referenced by path) → root `public/`; an
   asset imported from code → `src/assets/`.
6. A test → `<same folder>/<file>.test.js` next to the code; a helper shared by tests →
   `src/test/`.
7. Needs a literal native error-code string? → the string goes in `lib/errors/errorCodes.js`
   first, always.

## Subsystem deep dives
- `harness/repository-layout.md` — everything at the repo root outside `src/`: native
  projects, build config, `scripts/`, store tooling, what's generated vs. hand-maintained.
- `harness/styling.md` — Konsta UI first, Tailwind second; theme tokens; dark mode.
- `harness/map-data-pipeline.md` — offline map tiles, style, glyphs/sprites, and the
  navigation-graph build pipeline.

- `harness/screens.md` — every route, the shared navbar/tabbar/panel pattern every screen
  follows, and `views/Map/`'s internal split.
- `harness/state-management.md` — every `lib/state/` module, the `createUIProfile` base
  pattern, and how `store/ui/` relates to it.
- `harness/navigation-subsystem.md` — the A* pedestrian-routing engine, route caching, GPS
  tracking, and the turn-by-turn UI.
- `harness/custom-markers-subsystem.md` — the user-markers feature: file format, storage,
  photos, the editor dialog, the slider/viewer.

## Error handling

`lib/errors/errorCodes.js` holds every native-plugin error code the app checks against.
Geolocation codes are normalized through a mapper function (raw codes differ by platform);
Filesystem/Camera codes are stored as the literal string the plugin returns, compared
directly. `store/ui/errorToast.js` is the single user-facing channel: dedup, queueing, rate
limiting, with rate-limit bookkeeping kept out of the reactive store on purpose (see
`harness/performance.md`).
