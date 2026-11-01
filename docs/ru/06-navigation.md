# Навигация

Пешеходные маршруты по Ташкенту офлайн. Два режима:

- **по точкам** — пользователь тапает старт и финиш;
- **GPS** — маршрут строится от живой позиции пользователя до выбранной точки и
  пересчитывается, если пользователь с него сошёл.

```
services/navigation.js            NavigationEngine: A* по графу
services/navigationLoader.js      загрузка графа один раз + LRU-кэш маршрутов
capacitor/services/gpsTracker.js  слежение за позицией, расстояния, схождение с маршрута
capacitor/services/locationPermission.js   разрешение на геолокацию
views/Map/Navigation/             связка с картой: контроллеры, маркер пользователя, тосты
components/Navigation/            нижняя панель навигации и её содержимое
```

## Движок (`services/navigation.js`)

`NavigationEngine` — A\* по графу `{ nodes, edges }`. Модуль чистый: без Svelte и без Capacitor.

- В конструкторе строится список смежности, рёбра на несуществующие узлы отбрасываются, и
  создаётся пространственная сетка (`GRID_CELL_SIZE = 0.01°`) для поиска ближайшего узла.
- `findRoute(fromLon, fromLat, toLon, toLat)`:
  1. ищет ближайший узел к старту и к финишу: сначала в окрестности 3×3 клетки, потом шире;
  2. запускает A\* по бинарной куче (`MinHeap`) с эвристикой по формуле гаверсинуса.

Лимиты:

| Константа | Значение | Смысл |
| --- | --- | --- |
| `MAX_NODE_SNAP_DISTANCE` | 1000 м | Дальше от дороги точка не привязывается |
| `MAX_ROUTE_DISTANCE` | 50 000 м | Предел расстояния по прямой |
| `MAX_ITERATIONS` | 100 000 | Предел итераций A\* |

Результат:

```js
{
  success: true,
  route: {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: [[lon, lat], ...] },
    properties: { distance, nodes, computeTime, iterations },
  },
}
// или
{ success: false, message: 'No path found between points' }
```

`coordinates` начинаются с точной точки старта и заканчиваются точной точкой финиша. Узлы
графа лежат между ними. `distance` — длина пути по графу плюс расстояние привязки обоих концов.

## Загрузчик (`services/navigationLoader.js`)

Напрямую `NavigationEngine` из UI не используется, только через загрузчик.

```js
import { initNavigation, findRoute } from '@/services/navigationLoader';

await initNavigation();
const result = findRoute(69.2401, 41.2995, 69.2797, 41.3111);
if (result.success) fitMapToRoute(map, result.route);
```

- `initNavigation()` один раз загружает граф `public/map/navigation-graph-optimized.json`
  (запрос `fetch('/map/navigation-graph-optimized.json')`). Если вызвать её несколько раз
  одновременно, все вызовы получат один и тот же Promise. После неудачи следующий вызов
  пробует снова.
- `findRoute(...)` — с LRU-кэшем на `MAX_CACHE_SIZE = 50` маршрутов. Ключ кэша учитывает
  направление: A→B и B→A — разные записи, потому что в графе есть односторонние рёбра.
- `getNavigationEngine()` бросает ошибку, если `initNavigation()` ещё не завершилась.

**Известная проблема.** Граф весит ~28 МБ JSON. Он парсится в основном потоке в объекты со
строковыми ключами (`"n0"`), а `findRoute` работает синхронно. На слабом телефоне это долгий
фриз и большая куча. План исправления: бинарный граф на typed arrays и разбор плюс A\* в Web
Worker. Это меняет формат графа и скрипты сборки ([Данные карты](10-map-data.md)), поэтому
делается отдельной задачей и начинается с замера heap snapshot на устройстве.

## GPS-трекер (`capacitor/services/gpsTracker.js`)

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
  `checkOffRoute`, `resetRoute`, геттеры `isTracking` и `lastPosition`.
- Позиция: `{ lat, lon, accuracy, altitude, heading, speed, timestamp, isWithinBounds }`.
  `isWithinBounds` сверяется с `MAP_BOUNDS` из `data/mapArea.js`.
- Фильтры: позиции с точностью хуже `MAX_ACCEPTABLE_ACCURACY = 30` м отбрасываются, сдвиг
  меньше `MIN_DISTANCE_UPDATE = 5` м игнорируется (дрожание GPS, когда пользователь стоит).
- `OFF_ROUTE_THRESHOLD = 50` м — дальше этого пользователь считается сошедшим с маршрута.
  Ближайший отрезок ищется в окне `ROUTE_SEARCH_WINDOW = 50` точек вокруг последнего найденного.
- Чистые функции: `calculateDistance(lat1, lon1, lat2, lon2)` (метры, гаверсинус),
  `findNearestPointOnRoute(position, routeCoordinates, lastIndex)`.

## Разрешения (`capacitor/services/locationPermission.js`)

Общие для мастера первого запуска и для GPS. Новая функция, которой нужна геолокация,
работает через этот модуль, а не через `Geolocation.requestPermissions()`.

```js
import { checkLocationPermission, requestLocationPermission, openAppSettings } from '@/capacitor/services/locationPermission';

const status = await checkLocationPermission();
if (status.isGranted) {
  // можно пользоваться геолокацией
} else if (status.canRequest) {
  await requestLocationPermission({ onDenied: () => showSettingsHint() });
} else if (status.needsSettings) {
  await openAppSettings();
}
```

`mapGeolocationError(error)` приводит ошибку к одному из кодов `ERROR_CODES.OS_PLUG_GLOC_*`. На
входе может быть дефисный код плагина `OS-PLUG-GLOC-*`, числовой код веба или, в крайнем
случае, только текст сообщения.

## Контроллеры на карте (`views/Map/Navigation/`)

### По точкам — `MapNavigation.svelte.js`

`createNavigationController({ map, builder, i18n })`:

- состояние: `navigationMode`, `navigationReady`, `navigationLoading`, `routeInfo`,
  `currentRoute`, `dialogState`;
- методы: `toggleNavigationMode`, `handleMapClick` (первый тап ставит старт, второй — финиш
  и строит маршрут, третий открывает диалог «новый маршрут?»), `confirmNewDestination`,
  `clearNavigation`, `restoreMarkers` (после смены темы), `dispose`.

### GPS — `GPS/`

`MapNavigationGPS.svelte.js` — `createGPSNavigationController({ map, builder, i18n })`.
Связывает три части и сам решает только переключение режима, тапы и диалог «новая цель?».

```js
const gps = createGPSNavigationController({ map, builder, i18n });

await gps.toggleGPSMode();
gps.handleMapClick(event);
gps.confirmNewDestination();
gps.dispose();
```

Состояние для UI: `gpsMode`, `gpsReady`, `gpsLoading`, `routeInfo`, `currentRoute`,
`isArrived`, `isOutOfBounds`, `dialogState`.

| Модуль | Отвечает за |
| --- | --- |
| `MapGPSTracking.svelte.js` — `createGPSTracking({ map, messages, isActive, onPosition, onLeftMap })` | Живая позиция: запуск трекера вместе с движком, перелёт к первой позиции, точка пользователя, выход за область карты и возврат в неё. О маршрутах ничего не знает |
| `MapGPSRoute.svelte.js` — `createGPSRoute({ map, builder, messages, getTracker, reportOutOfBounds })` | Цель и маршрут к ней: строится сразу или с первой позицией, пересчитывается при сходе не чаще раза в `RECALC_THROTTLE_MS = 10000` мс, прибытие ближе `ARRIVAL_DISTANCE_THRESHOLD = 20` м. Трекинг не запускает и не останавливает |
| `MapGPSMessages.js` — `createGPSMessages({ i18n })` | Все тосты GPS: каждый код ошибки один раз до `forgetShownErrors()`, «ждём сигнал» один раз на цель, выход за область, ошибки маршрута |

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

`isActive` проверяется после каждого ожидания в `start()`. Если режим выключили во время
запуска, `start()` сам останавливает свой трекер.

### Общее для обоих режимов

- `MapUserMarker.js` — `createUserMarker(map)`: пульсирующая точка пользователя. `show(position)`
  при первом вызове добавляет её, дальше двигает; `remove()` убирает.
- `MapRouteFit.js` — `fitMapToRoute(map, route)`: камера по всему маршруту с отступом
  `ROUTE_FIT_PADDING`.
- `MapRouteMessages.js` — `createRouteMessages({ i18n, scope })`: тосты маршрутизации (движок не
  загрузился, маршрут не найден, расчёт упал). Тосты навигации идут только через этот модуль
  и `MapGPSMessages.js`, контроллер не вызывает `errorToast` напрямую.

## UI (`components/Navigation/`)

| Компонент | Что показывает |
| --- | --- |
| `NavigationSheet.svelte` | Нижняя панель. Открытие — обычный `createToggle()`: панелью управляет режим навигации, кнопку «Назад» она не регистрирует |
| `NavigationModeSelection.svelte` | Выбор режима: по точкам или GPS |
| `RouteStatus/NavigationInstruction.svelte` | Подсказка для активного режима |
| `RouteStatus/NavigationRouteInfo.svelte` | Расстояние и время |
| `RouteStatus/NavigationArrivalMsg.svelte` | Сообщение о прибытии, пока `isArrived`. Оно единственное, дублировать его тостом не нужно |
| `NavigationControlDialog.svelte` | Подтверждение остановки навигации |

## Куда вносить изменения

| Что меняется | Где |
| --- | --- |
| Алгоритм, лимиты, оценка маршрута | `services/navigation.js` |
| Загрузка и кэш | `services/navigationLoader.js` |
| GPS: частота, фильтры, схождение, расстояния | `capacitor/services/gpsTracker.js` |
| Как навигация рисуется на карте и переключает режимы | `views/Map/Navigation/` |
| Тексты и вид панели | `components/Navigation/*` + переводы во всех четырёх локалях |
