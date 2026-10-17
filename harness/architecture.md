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
`__APP_NAME__`/`__APP_VERSION__` build globals on the web), then mounts `App.svelte` and
hides the native splash. Each step falls back instead of stopping (default theme, build
name/version) and the splash is hidden in `finally`: `launchAutoHide` is off, so nothing else
would ever hide it.
`App.svelte` shows `AppSplash.svelte` until its own `onMount` init finishes
(`APP_READY`), and owns the Konsta `App`/`Page`/`Navbar`/`Panel` shell, the router outlet, the bottom tab bar,
the onboarding wizard, the article popup, and app-wide init (`initFirstLaunch`,
`initBackButtonHandler`, `initCustomPointsPersistence`). Routing is
`@mateothegreat/svelte5-router`, configured in `src/Routes.js` (one `{ path, component }`
entry per screen — see `harness/screens.md` for what each screen actually does).
`src/utils/routerUtils.js` maps a raw route path to a short "page key" string
(`resolvePageKeyFromRouteResult`), used for localization and navbar logic.

## Directory layout (`src/`) — what lives where, and where new code goes

### The tree

Every directory of `src/`, plus the entry-point files at its root — individual files inside
the directories are deliberately not listed (they change often; the subsystem files below
describe them where it matters). `src/architectureTree.test.js` checks this tree against the
real `src/`: a directory added, removed or renamed without updating it fails the suite.
A `{a,b}` group stands for sibling directories with the same role.

```
src/
├── main.js                     # boot: theme manager, app name/version, mount App
├── App.svelte                  # shell: Konsta App/Page/Navbar/Panel, router outlet, tabbar,
│                               #   onboarding, article popup, app-wide init
├── AppSplash.svelte            # splash until App's init finishes
├── Routes.js                   # route table: one { path, component } per screen
├── App.css                     # global CSS: Tailwind, Konsta theme, 3rd-party CSS, tokens
├── assets/                     # imported from code, processed by Vite (hashed)
│   ├── icons/
│   └── styles/
├── capacitor/                  # one file = one native plugin wrapper
│   ├── services/
│   └── utils/
├── components/                 # reusable components; shared ones at the top level
│   ├── CustomPoints/           #   user-marker editor, photos, slider, viewer
│   ├── Filters/                #   Handbook layout/category, map marker filter
│   └── Navigation/             #   turn-by-turn sheet and its parts
├── data/                       # static content: articles, technical-info meta
├── lib/
│   ├── errors/                 # errorCodes.js — the only home of native error-code literals
│   ├── icons/                  # SVG icon components
│   ├── state/                  # runes state modules (*.svelte.js)
│   └── theme/                  # themeManager.js — app-wide light/dark
├── locales/                    # i18next resources, aggregated by resources.js
│   └── {en,pl,ru,uz}/          #   ui, errors, articles, about + index.js
├── services/                   # business logic: no UI, no direct plugin call
├── store/                      # classic Svelte stores (pre-runes / store-contract interop)
│   ├── i18nextSvelte/
│   └── ui/
├── test/                       # test-only helpers; never imported by app code
├── utils/                      # small pure helpers, no runes, no dependencies
└── views/                      # one folder per screen
    ├── About/
    ├── Handbook/
    ├── Map/                    #   split into supporting modules, see screens.md
    ├── More/
    ├── OnboardingWizard/
    ├── Settings/
    └── TechnicalInfo/
```

### Rules per directory

- `capacitor/` — thin wrappers, exactly one Capacitor plugin per file (`backButton.js` sits
  at its root, the rest in `services/`/`utils/`). **A new native capability gets a new file
  here**, not raw plugin calls scattered through components — this is where platform quirks
  and error-code translation live, so the rest of the app only ever sees a clean function.
  Storage of small values/preferences goes through `utils/appStorage.js`
  (`setStorage`/`getStorage`); location permission through
  `services/locationPermission.js` — reuse those, don't call the plugin again.
- `components/` — grouped by feature area once there's more than one related component.
  A component used by more than one feature area goes at the top level, not duplicated into
  each area's folder (`Article.svelte` — the one article/marker popup, universal across
  historical and custom points — is the example). `ErrorHandlerToast.svelte` /
  `ExitToast.svelte` render the `errorToast` / `toastController` stores respectively.
- `data/` — static content only, no logic. Article ids look like `l01`..`l13`, `photos`
  paths are relative to `public/`. `about.js` feeds Technical Info, not About (see
  `harness/screens.md`).
- `lib/errors/errorCodes.js` — the **only** place a literal native-plugin error-code string
  is allowed. A new plugin's error code gets added here first (with a comment citing the
  plugin's own docs), imported from there — never `error.code === 'OS-PLUG-XXXX-0000'`
  inline in a service. `errorCodes.test.js` scans app code for such literals (`locales/` is
  exempt: its keys are named after the codes).
  Two kinds of code live there, told apart by the prefix so a toast or a log says at once
  *who* failed: **plugin codes** `OS_PLUG_<PLUGIN>_<NNNN>` (a plugin's own code, cited from
  its docs) and **app codes** — the app's own failures, named `<DOMAIN>_<WHAT>` by the
  area that fails (`NAV_ROUTE_NOT_FOUND`, `MAP_INIT_FAILED`, `PMTILES_FETCH`), never with an
  `OS_PLUG_` prefix. A new app-side failure the user must hear about gets a new app code
  here (plus its `errors.js` text in all four locales) when it's needed — not a reused plugin
  code, and not a set of codes added in advance.
- `lib/icons/` — check for an existing icon before adding a new one; an icon that stays
  unused is a fine thing to remove later, not to keep "just in case."
- `lib/theme/` — a plain-JS singleton with its own `subscribe`, not runes. See
  `harness/styling.md`.
- `lib/state/` — see `harness/state-management.md` — the single most important directory to
  understand before writing new state.
- `services/` — the custom-markers subsystem (`harness/custom-markers-subsystem.md`), the
  navigation subsystem (`harness/navigation-subsystem.md`), the map builders and popup/style
  building, the back-button overlay primitive `useOverlay.js`, and the router-history hook.
  Trap: `services/toastController.js` is a single-purpose "press back again to exit"
  countdown toast — despite the similar name, not the same system as `store/ui/errorToast.js`.
- `store/` — `ui/errorToast.js` is the single user-facing error/warning/info channel (use
  it, don't invent a new one); `ui/overlayController.js` is the back-button overlay stack
  (LIFO); `i18nextSvelte/` genuinely needs the store contract; `appStartInitialize.js`
  tracks first launch. No new `writable` stores — see `harness/svelte-rules.md`.
- `utils/` — small, dependency-free, pure functions. If it needs Svelte runes, it belongs in
  `lib/state/` instead. `debugMode.js` is the logger (`harness/code-style.md`),
  `inMemoryPmtilesSource.js` serves the map archive from RAM
  (`harness/map-data-pipeline.md`).
- `views/` — one folder per screen, wired in `Routes.js`. `views/Map/` is the one screen big
  enough to be split into supporting modules (builder wiring, lifecycle, theme, navigation,
  edit mode, load progress) — see `harness/screens.md`.
- `locales/` — `collections.js` is the language picker's code → name list. See
  `harness/i18n.md`.
- `assets/` vs. root `public/` — `assets/` is for files imported from code; static files that
  must keep a fixed url (map data, previews, fonts) go in the root `public/` instead.
- `test/` — shared test helpers and `setup.js`; test files themselves sit next to the code
  they test (`*.test.js`). See `harness/testing.md`.

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
Geolocation codes are normalized through a mapper function, `mapGeolocationError`
(`capacitor/services/locationPermission.js`): the plugin's hyphenated `OS-PLUG-GLOC-*`, the
web's numeric codes and, as a last resort, the error message all become one of the
underscored `ERROR_CODES.OS_PLUG_GLOC_*` (prefix `GEOLOCATION_CODE_PREFIX`) — only codes
`ERROR_CODES` knows, since each needs a translation in `errors.js`; Filesystem/Camera codes are stored as the literal string the plugin returns, compared
directly. `store/ui/errorToast.js` is the single user-facing channel: dedup, queueing, rate
limiting, with rate-limit bookkeeping kept out of the reactive store on purpose (see
`harness/performance.md`).
