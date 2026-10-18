---
paths:
  - "src/services/navigation.js"
  - "src/services/navigationLoader.js"
  - "src/capacitor/services/gpsTracker.js"
  - "src/capacitor/services/locationPermission.js"
  - "src/views/Map/MapNavigation*"
  - "src/components/Navigation/**"
  - "public/map/navigation-graph-optimized.json"
---

# Navigation subsystem (turn-by-turn, GPS)

Entirely separate from the custom-markers subsystem — this is what gets a user from where
they are to a place on the map, on foot.

## The routing engine

- `services/navigation.js` — `NavigationEngine`: an **A\* pathfinding** implementation over
  a pedestrian road-network graph, with named limits instead of magic numbers at the call
  site (`MAX_ITERATIONS`, `MAX_ROUTE_DISTANCE`, `MAX_NODE_SNAP_DISTANCE`). This is pure
  algorithmic logic, no Capacitor, no Svelte — a plain class/module that could be unit
  tested with nothing but coordinate fixtures.
- `services/navigationLoader.js` — `NavigationLoader`: lazy-loads the navigation graph and
  constructs a `NavigationEngine` from it, with an **LRU-cached route lookup** on top
  (routes are cached per direction — A→B and B→A are separate entries, because the graph
  has one-way edges and the engine routes along them — with a bounded cache size and
  least-recently-used eviction). Don't call `NavigationEngine` directly from
  UI code; go through the loader so the graph is loaded once and routes are reused.

## GPS and permissions

- `capacitor/services/locationPermission.js` — the permission flow (check status, request,
  handle every possible outcome, open app settings to fix a denied permission), shared
  between the onboarding wizard and GPS tracking. A new feature needing location permission
  goes through this, not a fresh `Geolocation.requestPermissions()` call.
- `capacitor/services/gpsTracker.js` — `createGPSTracker()`: watches the user's live
  position via the Capacitor Geolocation plugin, computes distance between coordinates, and
  detects route deviation (has the user wandered off the suggested path).

## UI glue and components

- `views/Map/MapNavigation.svelte.js`, `views/Map/MapNavigationGPS.svelte.js` — wire the
  engine/loader/tracker above into the map screen's own state and MapLibre layers (drawing
  the route line, moving the user-position marker).
- `components/Navigation/` — `NavigationSheet.svelte` (the bottom sheet shell, uses a plain
  `createToggle()` for its own open state — not an overlay-registered toggle, since it's
  driven by the map screen's navigation mode rather than needing independent back-button
  dismissal), `NavigationModeSelection.svelte` (manual vs. GPS mode picker),
  `NavigationInstruction.svelte` (turn-by-turn text for the active mode),
  `NavigationRouteInfo.svelte` (distance/duration summary), `NavigationArrivalMsg.svelte`
  (shown while `isArrived` is true — the one arrival message; don't add a second one via a
  toast), `NavigationControlDialog.svelte`
  (confirm-before-stopping-navigation dialog).

## Where a navigation-related addition goes

- A change to pathfinding itself (the algorithm, its limits, how it scores a route) →
  `services/navigation.js`.
- A change to how routes are loaded/cached → `services/navigationLoader.js`.
- A change to live GPS behavior (tracking frequency, deviation detection, distance math) →
  `capacitor/services/gpsTracker.js`.
- A change to how navigation state drives the map (drawing, markers, mode switching) →
  `views/Map/MapNavigation*.svelte.js`.
- A change to the navigation sheet's UI/text → the relevant `components/Navigation/*`
  component, with translations in all four locales per `.claude/rules/i18n.md`.
