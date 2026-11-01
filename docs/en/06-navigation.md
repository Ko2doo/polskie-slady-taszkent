# Navigation

Offline walking routes across Tashkent. Two modes:

- **point to point** — the user taps a start and a finish;
- **GPS** — the route goes from the user's live position to a chosen place and is recalculated
  when the user leaves it.

```
services/navigation.js            NavigationEngine: A* over the graph
services/navigationLoader.js      loads the graph once + LRU route cache
capacitor/services/gpsTracker.js  position watching, distances, off-route detection
capacitor/services/locationPermission.js   location permission
views/Map/Navigation/             wiring into the map: controllers, user marker, toasts
components/Navigation/            the navigation bottom sheet and its content
```

## Engine (`services/navigation.js`)

`NavigationEngine` is A\* over a `{ nodes, edges }` graph. A pure module: no Svelte, no Capacitor.

- The constructor builds the adjacency list, drops edges to missing nodes, and builds a spatial
  grid (`GRID_CELL_SIZE = 0.01°`) to find the nearest node.
- `findRoute(fromLon, fromLat, toLon, toLat)`:
  1. finds the nearest node to the start and to the finish: first in the 3×3 cells around, then wider;
  2. runs A\* on a binary heap (`MinHeap`) with a haversine heuristic.

Limits:

| Constant | Value | Meaning |
| --- | --- | --- |
| `MAX_NODE_SNAP_DISTANCE` | 1000 m | A point farther from a road isn't snapped |
| `MAX_ROUTE_DISTANCE` | 50,000 m | Straight-line distance limit |
| `MAX_ITERATIONS` | 100,000 | A\* iteration limit |

Result:

```js
{
  success: true,
  route: {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: [[lon, lat], ...] },
    properties: { distance, nodes, computeTime, iterations },
  },
}
// or
{ success: false, message: 'No path found between points' }
```

`coordinates` start at the exact start point and end at the exact finish point, with the graph
nodes in between. `distance` is the path length over the graph plus the snap distance of both ends.

## Loader (`services/navigationLoader.js`)

UI code never uses `NavigationEngine` directly, only through the loader.

```js
import { initNavigation, findRoute } from '@/services/navigationLoader';

await initNavigation();
const result = findRoute(69.2401, 41.2995, 69.2797, 41.3111);
if (result.success) fitMapToRoute(map, result.route);
```

- `initNavigation()` loads the graph `public/map/navigation-graph-optimized.json` once (as
  `fetch('/map/navigation-graph-optimized.json')`). Called several times at once, every call gets
  the same Promise. After a failure the next call tries again.
- `findRoute(...)` — with an LRU cache of `MAX_CACHE_SIZE = 50` routes. The cache key includes the
  direction: A→B and B→A are separate entries, because the graph has one-way edges.
- `getNavigationEngine()` throws if `initNavigation()` hasn't finished.

**Known issue.** The graph is a ~28 MB JSON. It's parsed on the main thread into objects with
string keys (`"n0"`), and `findRoute` runs synchronously. On a weak phone that's a long freeze
and a big heap. The planned fix: a binary graph on typed arrays, with parsing and A\* in a Web
Worker. It changes the graph format and the build scripts ([Map data](10-map-data.md)), so it's a
separate task that starts with a heap snapshot on a device.

## GPS tracker (`capacitor/services/gpsTracker.js`)

```js
import { createGPSTracker } from '@/capacitor/services/gpsTracker';

const tracker = createGPSTracker({
  onPositionUpdate: (position) => userMarker.show(position),
  onError: (error) => messages.gpsError(error),
});

const isStarted = await tracker.start();
const check = tracker.checkOffRoute(route.geometry.coordinates);
// { isOffRoute, distance, threshold } | null
await tracker.stop();
```

- API: `checkPermissions`, `requestPermissions`, `getCurrentPosition`, `start`, `stop`,
  `checkOffRoute`, `resetRoute`, getters `isTracking` and `lastPosition`.
- Position: `{ lat, lon, accuracy, altitude, heading, speed, timestamp, isWithinBounds }`.
  `isWithinBounds` is checked against `MAP_BOUNDS` from `data/mapArea.js`.
- Filters: positions with accuracy worse than `MAX_ACCEPTABLE_ACCURACY = 30` m are dropped, a move
  of less than `MIN_DISTANCE_UPDATE = 5` m is ignored (GPS jitter while the user stands still).
- `OFF_ROUTE_THRESHOLD = 50` m — farther than this, the user is off the route. The nearest segment
  is searched in a window of `ROUTE_SEARCH_WINDOW = 50` points around the last one found.
- Pure functions: `calculateDistance(lat1, lon1, lat2, lon2)` (meters, haversine),
  `findNearestPointOnRoute(position, routeCoordinates, lastIndex)`.

## Permissions (`capacitor/services/locationPermission.js`)

Shared by the first-launch wizard and GPS. A new feature that needs location goes through this
module, not through `Geolocation.requestPermissions()`.

```js
import { checkLocationPermission, requestLocationPermission, openAppSettings } from '@/capacitor/services/locationPermission';

const status = await checkLocationPermission();
if (status.isGranted) {
  // geolocation can be used
} else if (status.canRequest) {
  await requestLocationPermission({ onDenied: () => showSettingsHint() });
} else if (status.needsSettings) {
  await openAppSettings();
}
```

`mapGeolocationError(error)` turns an error into one of the `ERROR_CODES.OS_PLUG_GLOC_*` codes. The
input can be the plugin's hyphenated `OS-PLUG-GLOC-*` code, the web's numeric code or, as a last
resort, only the message text.

## Controllers on the map (`views/Map/Navigation/`)

### Point to point — `MapNavigation.svelte.js`

`createNavigationController({ map, builder, i18n })`:

- state: `navigationMode`, `navigationReady`, `navigationLoading`, `routeInfo`,
  `currentRoute`, `dialogState`;
- methods: `toggleNavigationMode`, `handleMapClick` (the first tap sets the start, the second
  the finish and builds the route, the third opens the "new route?" dialog),
  `confirmNewDestination`, `clearNavigation`, `restoreMarkers` (after a theme switch), `dispose`.

### GPS — `GPS/`

`MapNavigationGPS.svelte.js` — `createGPSNavigationController({ map, builder, i18n })`. Wires the
three parts together and itself decides only the mode switch, the taps and the "new destination?"
dialog.

```js
const gps = createGPSNavigationController({ map, builder, i18n });

await gps.toggleGPSMode();
gps.handleMapClick(event);
gps.confirmNewDestination();
gps.dispose();
```

State for the UI: `gpsMode`, `gpsReady`, `gpsLoading`, `routeInfo`, `currentRoute`,
`isArrived`, `isOutOfBounds`, `dialogState`.

| Module | Responsible for |
| --- | --- |
| `MapGPSTracking.svelte.js` — `createGPSTracking({ map, messages, isActive, onPosition, onLeftMap })` | The live position: starting the tracker together with the engine, flying to the first position, the user's dot, leaving and re-entering the map area. Knows nothing about routes |
| `MapGPSRoute.svelte.js` — `createGPSRoute({ map, builder, messages, getTracker, reportOutOfBounds })` | The destination and the route to it: built at once or with the first fix, recalculated off route at most once per `RECALC_THROTTLE_MS = 10000` ms, arrival closer than `ARRIVAL_DISTANCE_THRESHOLD = 20` m. Never starts or stops tracking |
| `MapGPSMessages.js` — `createGPSMessages({ i18n })` | Every GPS toast: each error code once until `forgetShownErrors()`, "waiting for signal" once per destination, map-area and route failures |

```js
const tracking = createGPSTracking({
  map,
  messages,
  isActive: () => gpsMode,
  onPosition: (position) => route.handlePosition(position),
  onLeftMap: () => clearNavigation(),
});

gpsMode = true;
if (!(await tracking.start())) gpsMode = false;
```

`isActive` is checked after every wait in `start()`. If the mode was switched off during the
start, `start()` stops its own tracker.

### Shared by both modes

- `MapUserMarker.js` — `createUserMarker(map)`: the user's pulsing dot. `show(position)` adds it on
  the first call and moves it after that; `remove()` takes it away.
- `MapRouteFit.js` — `fitMapToRoute(map, route)`: the camera fit to the whole route, with
  `ROUTE_FIT_PADDING`.
- `MapRouteMessages.js` — `createRouteMessages({ i18n, scope })`: the routing toasts (engine failed
  to load, no route, calculation crashed). Navigation toasts go only through this module and
  `MapGPSMessages.js`; a controller never calls `errorToast` directly.

## UI (`components/Navigation/`)

| Component | What it shows |
| --- | --- |
| `NavigationSheet.svelte` | The bottom sheet. Opened with a plain `createToggle()`: the navigation mode drives it, it doesn't register with the Back button |
| `NavigationModeSelection.svelte` | Mode choice: point to point or GPS |
| `RouteStatus/NavigationInstruction.svelte` | The hint for the active mode |
| `RouteStatus/NavigationRouteInfo.svelte` | Distance and time |
| `RouteStatus/NavigationArrivalMsg.svelte` | The arrival message while `isArrived`. It's the only one; don't duplicate it with a toast |
| `NavigationControlDialog.svelte` | Confirmation before stopping navigation |

## Where changes go

| What changes | Where |
| --- | --- |
| Algorithm, limits, route scoring | `services/navigation.js` |
| Loading and the cache | `services/navigationLoader.js` |
| GPS: frequency, filters, off-route detection, distances | `capacitor/services/gpsTracker.js` |
| How navigation draws on the map and switches modes | `views/Map/Navigation/` |
| Texts and look of the sheet | `components/Navigation/*` + translations in all four locales |
