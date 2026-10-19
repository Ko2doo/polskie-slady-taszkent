# Map screen (`views/Map/`)

The largest screen. Split by concern into three groups; modules shared by them sit at the
folder's root.

```
views/Map/
├── Map.svelte              the screen: start() on mount, dispose() on leave
├── MapClickRouter.js       which mode takes a tap on the map
├── MapConstants.js         screen constants: data paths, view, layer configs
├── Session/                the map from start to release
├── Points/                 points on the map and editing them
└── Navigation/             routes and GPS (details in navigation.md)
```

## Map session (`Session/`)

### `MapSession.svelte.js` — `createMapSession(options)`

Builds everything on the map and releases it all in one place. `Map.svelte` calls
`start(container)` in `onMount` and `dispose()` on unmount.

```js
import { onMount } from 'svelte';
import { createMapSession } from '@/views/Map/Session/MapSession.svelte';
import { resolveTargetCoords } from '@/views/Map/Session/MapLifecycle.svelte';
import { createCustomPointsEditor } from '@/views/Map/Points/MapCustomPointsEditor.svelte';

const targetCoords = $derived(resolveTargetCoords(route));

const session = createMapSession({
  i18n: $i18n,
  isPopupEnabled,
  getTargetCoords: () => targetCoords,
  onMapClick: handleUnifiedMapClick,
  onProgress: (value) => (mapLoadingProgress = value),
  onReady: () => (mapReady = true),
});

onMount(() => {
  session.start(mapContainer).then((isStarted) => {
    if (!isStarted) return;
    pointsEditor = createCustomPointsEditor({ session, i18n: $i18n });
  });

  return () => session.dispose();
});
```

The order in `start()`:

1. The tiles load (`initializePMTiles`) while the style is built (`buildMapStyle(theme, language)`):
   they don't depend on each other.
2. `initializeMap({ container, style })` creates the MapLibre instance.
3. `createBuilders()` creates the historical-places builder and the user-markers builder.
4. `restoreSavedPoints()` waits for `customPointsState.ready` and puts the markers on the map at
   once, without covers. The covers follow in the background through `showPreview(point)`; the
   map doesn't wait for them.
5. `createControllers()` creates point-to-point navigation, GPS navigation and the theme controller.
6. On `load`, the tap handlers are attached and the sources are marked as added.

`start()` resolves to `true` when everything is built. `false` means it failed (the user got a
`MAP_INIT_FAILED` toast) or the session was closed while loading.

**Cancellation.** If the user leaves the screen while the map is loading, `dispose()` releases
what already exists. After every `await`, `start()` calls `checkpoint()`: on a closed session it
throws `CANCELLED`, and `start()` releases what it created since. That way no live WebGL context
is left on a detached container. `release()` is safe to call any number of times.

**A new resource on the map** (a layer, a source, an image) touches three places in this file:

- create it in `start()`;
- release it in `release()`;
- put it back in `restoreAfterStyleChange()`. A theme switch replaces the whole style with all
  its sources, layers and images, so without this the resource disappears after the first
  theme switch.

Getters: `builder`, `customPointsBuilder`, `navigation`, `gpsNavigation` (the last two are
reactive), `previews`, `showPreview(point)`.

### `MapLifecycle.svelte.js`

| Function | What it does |
| --- | --- |
| `initializePMTiles(i18n)` | Loads the whole `.pmtiles` into memory, registers the `pmtiles://` protocol. The protocol is reference-counted: if the old screen hasn't closed yet and the new one has already registered, only the last one to close removes it |
| `initializeMap({ container, style })` | `new maplibregl.Map(...)` with `INITIAL_VIEW` and a compact Protomaps/OSM attribution |
| `setupMapHandlers({ map, builder, customPointsBuilder, targetCoords })` | After `load`: `MAP_BOUNDS`, the city boundary, the markers, `customPointsBuilder.init()`, a fly to `targetCoords` |
| `cleanupMap({ map, protocol, builder, customPointsBuilder, navigation, theme })` | Releases everything listed, any field may be `null` |
| `resolveTargetCoords(route)` | Coordinates from the route's query (`/?lon=..&lat=..`) or `null` |

### `MapTheme.svelte.js`

- `getCurrentMapTheme()` returns `'light'` or `'dark'` from `themeManager`.
- `buildMapStyle(theme, lang)` builds the MapLibre style (`services/mapStyle.js`).
- `createThemeController({ map, i18n, onStyleRestored })` subscribes to `themeManager` and calls
  `map.setStyle()` when the theme changes. The label language comes from `i18n` when the style
  is built. Once the new style has loaded, the controller calls `onStyleRestored(version)`. It
  doesn't know what's on the map: putting it back is the session's job.

```js
const style = await buildMapStyle(getCurrentMapTheme(), i18n.language);
const map = initializeMap({ container, style });
```

### `MapLoadTracker.js`

`createMapLoadTracker({ map, setProgress, setReady, startOffset })` tracks MapLibre's
source-loading progress for the loading screen. `markSourcesAdded()` is called after `load`.

## Points (`Points/`)

### `MapBuilder.svelte.js`

Assembles the builders from `services/` with the screen's configs:

```js
const builder = createMapPointsBuilder({
  map,
  data: articlesMeta,
  i18n,
  popupTrigger: (id) => articlePopupState.open(id),
  isPopupEnabled,
  styleVersion: INITIAL_STYLE_VERSION,
});
const customPointsBuilder = createCustomPointsBuilder({ map, i18n, popupTrigger, isPopupEnabled, styleVersion });
```

The builder chain inside:

```js
MapPointsBuilder.create()
  .withMap(map)
  .withData(data)
  .withStyleVersion(styleVersion)
  .withI18n({
    title: (item) => i18n.t(`articles:${item.id}:title`),
    popupLink: () => i18n.t('ui:buttons:readMore'),
  })
  .withPopup(popupTrigger)
  .withPopupGuard(isPopupEnabled)
  .withMarkers(MARKER_CONFIG.customMarkers)
  .withCityBoundaries(BOUNDARY_CONFIG)
  .build();
```

**`services/mapPointsBuilder.js` (`MapPointsBuilder`)** — historical places and the city boundary:

- `addCityBoundaryLayer()`, `addMarkers()` — the layers; called again after a style change.
- `setMarkersVisible(isVisible)` — the marker filter.
- `isMarkerNear(screenPoint, radius)` — whether a historical marker is nearby. The editor
  doesn't allow a marker right next to one.
- `addNavigationRoute(routeGeoJSON)` / `clearNavigationRoute()` — the navigation route line.
- `setStyleVersion(version)`, `dispose()`.
- Coordinates in `data/articles.js` are stored as `[lat, lon]`; the builder flips them to
  GeoJSON `[lon, lat]`.

**`services/customPointsBuilder.js` (`CustomPointsBuilder`)** — user markers:

- `init()` — after `load` and after every style change. The points are kept in the builder's
  memory and come back on their own.
- `addPoint({ id, coords: { lng, lat }, title, preview })`, `updatePoint({ id, ...})`,
  `removePoint(id)`, `getPoints()`, `clearPoints()`.
- `getPointIdAt(screenPoint)` — which marker is under the finger.
- `setVisible(isVisible)`, `setStyleVersion(version)`, `dispose()`.

The popup HTML and escaping are shared by both builders: `services/mapPopupHtml.js`
(`escapeHtml`, `createPopupHTML`). A marker's title is user input, so it reaches the HTML only
through `escapeHtml`.

### `MapPreview.js`

- `resolvePreview(point)` — the url of the cover, i.e. the first photo, or `''`.
- `createPreviewTracker()` holds one photo-url reference per point. On the web it's a
  reference-counted Blob url.

```js
const previews = createPreviewTracker();
const url = await previews.resolve(point);
previews.release(point.id);
previews.releaseAll();
```

### `MapCustomPointsEditor.svelte.js` — `createCustomPointsEditor({ session, i18n })`

The marker-editing logic on the map. Described in [Custom markers](custom-markers.md#the-editor-on-the-map).

### `MapEditMode.svelte.js` — `createEditModeController()`

The edit mode's small state: tap coordinates, the `id` of the point being edited, whether the
dialog is open. A factory, not a singleton: one instance per screen, owned by the editor.

## Map taps (`MapClickRouter.js`)

`routeMapClick(event, modes)` hands a tap to exactly one mode, by priority:

1. GPS navigation, if it's on and ready (`gpsMode && gpsReady`);
2. point-to-point navigation (`navigationMode`);
3. the marker edit mode (`isEditing`).

Returns `CLICK_MODE.GPS | NAVIGATION | EDIT` or `null`.

```js
map.on('click', (event) => {
  routeMapClick(event, { gpsNavigation, navigation, pointsEditor, isEditing: editToggle.value });
});
```

A new mode that needs taps gets its place in this priority here.

## Constants (`MapConstants.js`)

`PMTILES_PATH`, `PMTILES_KEY`, `CITY_BOUNDARIES`, `INITIAL_VIEW`, `MARKER_CONFIG`,
`CUSTOM_POINTS_CONFIG`, `EDIT_MODE_CONFIG`, `MARKER_STYLE`, `BOUNDARY_CONFIG`,
`ROUTE_FIT_PADDING`. The map area (`MAP_BOUNDS`) lives separately in `data/mapArea.js`: GPS
tracking reads it too.
