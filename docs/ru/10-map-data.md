# Данные карты

Всё, что нужно карте и маршрутизатору, лежит в сборке, в `public/`. Из интернета в рантайме
ничего не скачивается.

| Файл | Кто читает | Откуда берётся |
| --- | --- | --- |
| `public/map/tashkent_<YYYYMMDD>.pmtiles` | `views/Map/Session/MapLifecycle.svelte.js` (`initializePMTiles`), путь в `PMTILES_PATH` | Выгрузка Protomaps/PMTiles по Ташкенту, скрипта для неё в репозитории нет |
| `public/map/navigation-graph-optimized.json` | `services/navigationLoader.js` | `scripts/navigationGraph/` (ниже) |
| `public/map/tashkent_boundaries.geojson` | `CITY_BOUNDARIES` в `MapConstants.js`, слой границы города | Без скрипта |
| `public/map/sprites/{light,dark}/*` | `services/mapStyle.js` (`sprite`) | `npm run map:download-sprites` |
| `public/fonts/map/<fontstack>/<range>.pbf` | `services/mapStyle.js` (`glyphs`); все подписи используют `Roboto Regular` | Готовые PBF-глифы |
| `public/map/icons/*.png` (рядом исходники `.svg`) | `MapConstants.js`: иконки точек, GPS, стрелок | Нарисованы вручную |

## Тайлы

`initializePMTiles` один раз загружает архив `.pmtiles` целиком в `ArrayBuffer` и оборачивает его
в `InMemoryPMTilesSource` (`utils/inMemoryPmtilesSource.js`). Этот класс реализует интерфейс
`Source` из pmtiles: `getKey()` и `getBytes(offset, length)`.

```js
import { PMTiles, Protocol } from 'pmtiles';
import { InMemoryPMTilesSource } from '@/utils/inMemoryPmtilesSource';

const buffer = await (await fetch(PMTILES_PATH)).arrayBuffer();
const protocol = new Protocol();
protocol.add(new PMTiles(new InMemoryPMTilesSource(PMTILES_KEY, buffer)));
maplibregl.addProtocol('pmtiles', protocol.tile);
```

Почему архив целиком в памяти: локальный веб-сервер Capacitor и `file://` не гарантируют
поддержку HTTP Range-запросов, а стандартный `FetchSource` из pmtiles на них опирается. Плата
за это — память: архив живёт в RAM всё время, пока открыта карта. Поэтому **файл `.pmtiles`
должен быть маленьким**: только bbox города, разумный максимальный zoom. Новая или более
крупная выгрузка — это изменение производительности, проверяйте его на слабом устройстве.

## Стиль

Статического файла стиля нет. `services/mapStyle.js` → `buildBaseMapStyle({ origin, pmtilesKey,
theme, lang, fontstack })` собирает стиль MapLibre в рантайме из `@protomaps/basemaps`
(`layers`, `namedFlavor`) под тему и язык. Глифы и спрайты берутся локальные.

```js
import { buildBaseMapStyle } from '@/services/mapStyle';

const style = buildBaseMapStyle({
  origin: window.location.origin,
  pmtilesKey: 'tashkent-local',
  theme: 'dark',
  lang: 'ru',
});
```

`scripts/generateMaplibreBaseStyle.mjs` — старый вариант со статическим стилем. В текущей сборке
он не используется.

## Граф навигации

Шаги также описаны в `scripts/navigationGraph/instructions.txt`:

```bash
cd scripts/overpass
bash curl-commands.txt
npx osmtogeojson tashkent_roads.json > tashkent_roads.geojson
cd ../..
node scripts/navigationGraph/build-navigation-graph.mjs
node scripts/navigationGraph/optimize-graph.mjs
cp scripts/navigationGraph/dist/optimized/navigation-graph-optimized.json public/map/
```

1. **Дороги.** `scripts/overpass/query.overpass` — запрос Overpass QL: пешеходные `highway=*`
   в bbox Ташкента (`41.167,69.117,41.42,69.525`). `curl-commands.txt` отправляет его на
   overpass-api.de, результат — `tashkent_roads.json`.
2. **Конвертация** в GeoJSON через `osmtogeojson`. Это глобальная CLI-утилита, в зависимости
   проекта она не входит.
3. **Сборка** графа `{ nodes, edges }`. Узлы дедуплицируются по координатам, округлённым до 6
   знаков. Рёбра направленные, и каждая дорога получает оба направления **для пешехода**:
   `oneway=yes` ограничивает машины, а не людей. Дорога считается односторонней только с
   `oneway:foot` или если сама является `footway`/`path`/`steps`/`pedestrian` с тегом `oneway`
   (`-1` разворачивает направление).
4. **Оптимизация** → `dist/optimized/navigation-graph-optimized.json`.
5. *(Необязательно)* `compress-coordinates.mjs` → `dist/navigation-graph-final.json`. Приложение
   этот вариант **не** загружает.
6. **Поставка** — копирование вручную в `public/map/`.

Формат графа — контракт между скриптами сборки и `services/navigation.js` /
`navigationLoader.js`. Меняется одна сторона — меняйте и тестируйте другую в том же изменении.
`services/navigation.test.js` проверяет на реальном графе, что он проходим в обе стороны и
связывает каждую пару исторических мест.

`scripts/overpass/*.json|geojson` лежат в git. Каталог `scripts/navigationGraph/dist/`
игнорируется.
