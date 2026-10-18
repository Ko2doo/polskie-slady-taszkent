---
paths:
  - "src/views/**"
  - "src/Routes.js"
  - "src/App.svelte"
  - "src/AppSplash.svelte"
  - "src/utils/routerUtils.js"
  - "src/services/navigationHistoryHook.js"
  - "src/lib/state/navbar.svelte.js"
  - "src/lib/state/bottomTabbarNav.svelte.js"
---

# Screens

## The shared pattern every screen follows

Every route component (`src/Routes.js`) receives `{ route, i18n }` as props (some also take
`appName`/`appLogo`/`version`/`appState` from `App.svelte`) and, in an `$effect`, configures
the shared chrome it needs: `withNavbar({...})` (`lib/state/navbar.svelte.js`) and, only if
the screen has **no** tab bar, `hideTabbar({...})` (`lib/state/bottomTabbarNav.svelte.js`).
Both return a dispose/release function — **always return it from the `$effect`**, so the
chrome is given back when the screen unmounts or the config changes. The tab bar is visible
unless some request holds it hidden, so a tab screen (Map, Handbook, More) does nothing about
it, and its return after Settings/About/Technical Info, the onboarding, the splash or the
map's edit mode doesn't depend on the order screens mount and unmount in. Use
`resolvePageKeyFromRouteResult(route?.result)` (`utils/routerUtils.js`) to map the current path to a page key for localization/navbar
logic rather than hand-parsing `route.result` yourself. Back navigation goes through
`routerBack()` (`services/navigationHistoryHook.js`), not a raw router call, so it
integrates with the app's own back-button/history stack (`capacitor/backButton.js`). Its
fallback is the screen's parent: `routerBack('/more')` from a screen opened in More — after a
reload the in-memory history is empty and the fallback is where back goes.

A new screen: add its component to `src/Routes.js`, give it this same `$effect` +
`withNavbar` (and `hideTabbar` if it has no tab bar) setup, and add a page key to
`resolvePageKeyFromRouteResult` if it needs one.

## The routes

- **`/` → `Map`** (`views/Map/Map.svelte`). The map screen, by far the largest — it's split
  into supporting modules rather than one giant component:
  - `MapBuilder.svelte.js` — wires `mapPointsBuilder.js` (historical) and
    `customPointsBuilder.js` (user markers) together.
  - `MapSession.svelte.js` — `createMapSession()`: builds the map and everything on it, in
    order (tiles, style, map, builders, saved points, navigation, theme controller), and is the
    one place it's all released. `Map.svelte` calls `start()` on mount and `dispose()` on
    unmount; leaving mid-load is handled inside (a checkpoint after every wait). A new resource
    on the map is created in `start()` and released in its `release()`, nowhere else. The
    tiles load while the style is built; saved points go on the map at once and their covers
    follow (`showPreview()`, also used by the editor after a save).
  - `MapLifecycle.svelte.js`, `MapTheme.svelte.js` — the steps the session uses: map instance,
    tiles protocol and their cleanup; light/dark style switching (`services/mapStyle.js`).
    `getCurrentMapTheme()`/`buildMapStyle()` build the first style before any controller
    exists; the theme controller is created once, with the map.
  - `MapCustomPointsEditor.svelte.js` — custom-point editing: the edit-mode tap, save and
    delete, keeping the map and the points state in step (see
    `.claude/rules/custom-markers-subsystem.md`). Owns the `MapEditMode.svelte.js` controller.
  - `MapClickRouter.js` — `routeMapClick()`: which mode takes a map tap (ready GPS
    navigation, then point-to-point navigation, then the edit mode). A new map mode that
    takes taps gets its place in this priority here.
  - `MapEditMode.svelte.js` — the marker-editing mode's own small state (tap coordinates,
    which point is being edited, dialog open/closed) via `createEditModeController()`, a
    `.svelte.js` factory, not a singleton — one controller per map screen, held by the editor.
  - `MapNavigation.svelte.js` / `MapNavigationGPS.svelte.js` — turn-by-turn routing and GPS
    tracking UI glue; see `.claude/rules/navigation-subsystem.md` for the actual engine.
  - `MapLoadTracker.js` — tracks MapLibre source-loading progress for the loading screen.
  - `MapPreview.js` — resolves a custom point's cover photo for the map popup;
    `createPreviewTracker()` holds one photo-url reference per point and gives it back when the
    cover changes, the point is deleted or the screen goes away (Blob urls on the web).
  - `MapConstants.js` — shared magic numbers/config for the screen.
- **`/handbook` → `Handbook`** (`views/Handbook/Handbook.svelte`). The browsable list of
  historical places (`data/articles.js` via `articlesMeta`), with layout switching (grid/
  list, `components/Filters/LayoutSwitcher.svelte` + `store/ui/layoutView.js`), category
  filtering (`components/Filters/SortingByCategories.svelte`), and search
  (`components/SearchBar.svelte`). Opens an article via `articlePopupState`
  (`lib/state/article.svelte.js`), the same popup state the map screen uses — one article
  popup, shared across entry points.
- **`/more` → `More`** (`views/More/More.svelte`). A simple menu linking to Settings, About,
  Technical Info — uses `goto()` from the router directly rather than the back-button-aware
  history hook, since these are forward navigations, not "back."
- **`/settings` → `Settings`** (`views/Settings/Settings.svelte`). Language, dark mode,
  and the app's OS-level permission settings (via `openAppSettings()` from
  `capacitor/services/locationPermission.js`).
- **`/about` → `About`** (`views/About/About.svelte`). App info, sourced from a translated
  `about:fullInfo` object (`returnObjects: true`), not from `data/about.js` (that file feeds
  Technical Info instead — don't confuse the two).
- **`/technical-info` → `TechnicalInfo`** (`views/TechnicalInfo/TechnicalInfo.svelte`).
  Credits/dependencies list, sourced from `data/about.js`'s `technicalInfoMeta`.

## Not a route: the onboarding wizard and the article popup

- `views/OnboardingWizard/OnboardingWizard.svelte` is shown from `App.svelte` on first
  launch (tracked via `store/appStartInitialize.js`), not routed to — it's a `Popup`
  overlay, not a screen. It requests location permission
  (`capacitor/services/locationPermission.js`), lets the user set language/theme, and uses
  a plain `createToggle()` for its own open state (not `createToggleOverlay` — it isn't
  meant to be closed by the Android back button mid-onboarding).
- `components/Article.svelte` (the historical-place/custom-marker article popup) is also
  rendered from `App.svelte`, driven by the module-singleton `articlePopupState`
  (`lib/state/article.svelte.js`), opened from either `Handbook` or the map popup — one
  popup instance, whichever screen triggered it.
