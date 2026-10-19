# Экран карты (`views/Map/`)

Самый большой экран. Разбит по задачам на три группы, общие для них модули лежат в корне папки.

```
views/Map/
├── Map.svelte              экран: start() при монтировании, dispose() при уходе
├── MapClickRouter.js       какой режим получает клик по карте
├── MapConstants.js         константы экрана: пути к данным, вид, конфиги слоёв
├── Session/                карта от запуска до освобождения
├── Points/                 точки на карте и их редактирование
└── Navigation/             маршруты и GPS (подробно в navigation.md)
```

## Сессия карты (`Session/`)

### `MapSession.svelte.js` — `createMapSession(options)`

Строит всё, что есть на карте, и освобождает всё в одном месте. `Map.svelte` вызывает
`start(container)` в `onMount` и `dispose()` при размонтировании.

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

Порядок в `start()`:

1. Параллельно грузятся тайлы (`initializePMTiles`) и собирается стиль
   (`buildMapStyle(theme, language)`): они не зависят друг от друга.
2. `initializeMap({ container, style })` создаёт экземпляр MapLibre.
3. `createBuilders()` создаёт билдер исторических мест и билдер своих меток.
4. `restoreSavedPoints()` ждёт `customPointsState.ready` и сразу ставит метки на карту без
   обложек. Обложки догружаются в фоне через `showPreview(point)`, карта их не ждёт.
5. `createControllers()` создаёт навигацию по точкам, GPS-навигацию и контроллер темы.
6. На `load` вешаются обработчики кликов, отмечается, что источники добавлены.

`start()` возвращает `true`, если всё построено. `false` означает, что произошла ошибка
(пользователь получил тост `MAP_INIT_FAILED`) или сессию закрыли во время загрузки.

**Отмена.** Если пользователь ушёл с экрана, пока карта грузится, `dispose()` освобождает то,
что уже создано. `start()` после каждого `await` вызывает `checkpoint()`: при закрытой
сессии он бросает `CANCELLED`, и `start()` освобождает созданное после этого. Так на
отсоединённом контейнере не остаётся живого WebGL-контекста. `release()` можно вызывать
сколько угодно раз.

**Новый ресурс на карте** (слой, источник, изображение) затрагивает три места этого файла:

- создать в `start()`;
- освободить в `release()`;
- вернуть в `restoreAfterStyleChange()`. Смена темы заменяет стиль целиком вместе со всеми
  источниками, слоями и изображениями, поэтому без этого ресурс пропадёт после первого же
  переключения темы.

Геттеры: `builder`, `customPointsBuilder`, `navigation`, `gpsNavigation` (последние два
реактивные), `previews`, `showPreview(point)`.

### `MapLifecycle.svelte.js`

| Функция | Что делает |
| --- | --- |
| `initializePMTiles(i18n)` | Загружает `.pmtiles` целиком в память, регистрирует протокол `pmtiles://`. Протокол считает ссылки: если старый экран ещё не закрылся, а новый уже зарегистрировался, протокол удалит только последний закрывшийся |
| `initializeMap({ container, style })` | `new maplibregl.Map(...)` с `INITIAL_VIEW` и компактной атрибуцией Protomaps/OSM |
| `setupMapHandlers({ map, builder, customPointsBuilder, targetCoords })` | После `load`: границы `MAP_BOUNDS`, граница города, маркеры, `customPointsBuilder.init()`, перелёт к `targetCoords` |
| `cleanupMap({ map, protocol, builder, customPointsBuilder, navigation, theme })` | Освобождает всё перечисленное, каждое поле может быть `null` |
| `resolveTargetCoords(route)` | Координаты из query маршрута (`/?lon=..&lat=..`) или `null` |

### `MapTheme.svelte.js`

- `getCurrentMapTheme()` возвращает `'light'` или `'dark'` по `themeManager`.
- `buildMapStyle(theme, lang)` собирает стиль MapLibre (`services/mapStyle.js`).
- `createThemeController({ map, i18n, onStyleRestored })` подписывается на `themeManager`
  и при смене темы вызывает `map.setStyle()`. Язык подписей берётся из `i18n` при сборке
  стиля. После загрузки нового стиля контроллер вызывает `onStyleRestored(version)`. Что лежит
  на карте, он не знает: восстановлением занимается сессия.

```js
const style = await buildMapStyle(getCurrentMapTheme(), i18n.language);
const map = initializeMap({ container, style });
```

### `MapLoadTracker.js`

`createMapLoadTracker({ map, setProgress, setReady, startOffset })` следит за прогрессом
загрузки источников MapLibre для экрана загрузки. `markSourcesAdded()` вызывается после `load`.

## Точки (`Points/`)

### `MapBuilder.svelte.js`

Собирает билдеры из `services/` с конфигами экрана:

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

Внутри цепочка билдера:

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

**`services/mapPointsBuilder.js` (`MapPointsBuilder`)** — исторические места и граница города:

- `addCityBoundaryLayer()`, `addMarkers()` — слои; после смены стиля вызываются повторно.
- `setMarkersVisible(isVisible)` — фильтр меток.
- `isMarkerNear(screenPoint, radius)` — есть ли рядом исторический маркер. Редактор не даёт
  ставить метку вплотную к нему.
- `addNavigationRoute(routeGeoJSON)` / `clearNavigationRoute()` — линия маршрута навигации.
- `setStyleVersion(version)`, `dispose()`.
- Координаты в `data/articles.js` хранятся как `[lat, lon]`, билдер переворачивает их в GeoJSON
  `[lon, lat]`.

**`services/customPointsBuilder.js` (`CustomPointsBuilder`)** — свои метки:

- `init()` — после `load` и после каждой смены стиля. Точки хранятся в памяти билдера и
  восстанавливаются сами.
- `addPoint({ id, coords: { lng, lat }, title, preview })`, `updatePoint({ id, ...})`,
  `removePoint(id)`, `getPoints()`, `clearPoints()`.
- `getPointIdAt(screenPoint)` — какая метка под пальцем.
- `setVisible(isVisible)`, `setStyleVersion(version)`, `dispose()`.

HTML попапа и экранирование общие для обоих билдеров: `services/mapPopupHtml.js`
(`escapeHtml`, `createPopupHTML`). Заголовок метки задаёт пользователь, поэтому в HTML он
попадает только через `escapeHtml`.

### `MapPreview.js`

- `resolvePreview(point)` — url обложки, то есть первого фото, или `''`.
- `createPreviewTracker()` держит по одной ссылке на url фото для каждой точки. В вебе это
  Blob-url со счётчиком ссылок.

```js
const previews = createPreviewTracker();
const url = await previews.resolve(point);
previews.release(point.id);
previews.releaseAll();
```

### `MapCustomPointsEditor.svelte.js` — `createCustomPointsEditor({ session, i18n })`

Логика редактирования меток на карте. Описана в [Пользовательские метки](custom-markers.md#редактор-на-карте).

### `MapEditMode.svelte.js` — `createEditModeController()`

Небольшое состояние режима редактирования: координаты тапа, `id` редактируемой точки,
открыт ли диалог. Фабрика, а не синглтон: экземпляр один на экран, им владеет редактор.

## Клики по карте (`MapClickRouter.js`)

`routeMapClick(event, modes)` передаёт тап ровно одному режиму, по приоритету:

1. GPS-навигация, если она включена и готова (`gpsMode && gpsReady`);
2. навигация по точкам (`navigationMode`);
3. режим редактирования меток (`isEditing`).

Возвращает `CLICK_MODE.GPS | NAVIGATION | EDIT` или `null`.

```js
map.on('click', (event) => {
  routeMapClick(event, { gpsNavigation, navigation, pointsEditor, isEditing: editToggle.value });
});
```

Новый режим, которому нужны тапы, получает своё место в этом приоритете здесь.

## Константы (`MapConstants.js`)

`PMTILES_PATH`, `PMTILES_KEY`, `CITY_BOUNDARIES`, `INITIAL_VIEW`, `MARKER_CONFIG`,
`CUSTOM_POINTS_CONFIG`, `EDIT_MODE_CONFIG`, `MARKER_STYLE`, `BOUNDARY_CONFIG`,
`ROUTE_FIT_PADDING`. Область карты (`MAP_BOUNDS`) лежит отдельно, в `data/mapArea.js`: её
читает ещё и GPS-трекинг.
