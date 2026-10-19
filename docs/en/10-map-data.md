# Map data

Everything the map and the router need ships inside the build, in `public/`. Nothing is
downloaded from the internet at runtime.

| File | Read by | Produced by |
| --- | --- | --- |
| `public/map/tashkent_<YYYYMMDD>.pmtiles` | `views/Map/Session/MapLifecycle.svelte.js` (`initializePMTiles`), path in `PMTILES_PATH` | A Protomaps/PMTiles extract of Tashkent; no script for it in the repository |
| `public/map/navigation-graph-optimized.json` | `services/navigationLoader.js` | `scripts/navigationGraph/` (below) |
| `public/map/tashkent_boundaries.geojson` | `CITY_BOUNDARIES` in `MapConstants.js`, the city-boundary layer | No script |
| `public/map/sprites/{light,dark}/*` | `services/mapStyle.js` (`sprite`) | `npm run map:download-sprites` |
| `public/fonts/map/<fontstack>/<range>.pbf` | `services/mapStyle.js` (`glyphs`); every label uses `Roboto Regular` | Pre-generated PBF glyphs |
| `public/map/icons/*.png` (`.svg` sources beside them) | `MapConstants.js`: point, GPS, arrow icons | Hand-made |

## Tiles

`initializePMTiles` loads the whole `.pmtiles` archive into an `ArrayBuffer` once and wraps it in
`InMemoryPMTilesSource` (`utils/inMemoryPmtilesSource.js`). That class implements pmtiles'
`Source` interface: `getKey()` and `getBytes(offset, length)`.

```js
import { PMTiles, Protocol } from 'pmtiles';
import { InMemoryPMTilesSource } from '@/utils/inMemoryPmtilesSource';

const buffer = await (await fetch(PMTILES_PATH)).arrayBuffer();
const protocol = new Protocol();
protocol.add(new PMTiles(new InMemoryPMTilesSource(PMTILES_KEY, buffer)));
maplibregl.addProtocol('pmtiles', protocol.tile);
```

Why the whole archive is in memory: Capacitor's local web server and `file://` don't reliably
support HTTP Range requests, and pmtiles' default `FetchSource` relies on them. The price is
memory: the archive lives in RAM as long as the map is open. So **the `.pmtiles` file must stay
small**: the city bbox only, a sane max zoom. A new or larger extract is a performance change —
check it on a weak device.

## Style

There's no static style file. `services/mapStyle.js` → `buildBaseMapStyle({ origin, pmtilesKey,
theme, lang, fontstack })` builds the MapLibre style at runtime from `@protomaps/basemaps`
(`layers`, `namedFlavor`) for a theme and a language. Glyphs and sprites are local.

```js
import { buildBaseMapStyle } from '@/services/mapStyle';

const style = buildBaseMapStyle({
  origin: window.location.origin,
  pmtilesKey: 'tashkent-local',
  theme: 'dark',
  lang: 'ru',
});
```

`scripts/generateMaplibreBaseStyle.mjs` is an older static-style variant. The current build
doesn't use it.

## Navigation graph

The steps are also in `scripts/navigationGraph/instructions.txt`:

```bash
cd scripts/overpass
bash curl-commands.txt
npx osmtogeojson tashkent_roads.json > tashkent_roads.geojson
cd ../..
node scripts/navigationGraph/build-navigation-graph.mjs
node scripts/navigationGraph/optimize-graph.mjs
cp scripts/navigationGraph/dist/optimized/navigation-graph-optimized.json public/map/
```

1. **Roads.** `scripts/overpass/query.overpass` is an Overpass QL query: walkable `highway=*` in
   the Tashkent bbox (`41.167,69.117,41.42,69.525`). `curl-commands.txt` sends it to
   overpass-api.de; the result is `tashkent_roads.json`.
2. **Conversion** to GeoJSON with `osmtogeojson`. It's a global CLI tool, not a project dependency.
3. **Build** the `{ nodes, edges }` graph. Nodes are deduplicated by coordinates rounded to 6
   decimals. Edges are directed, and every way gets both directions **for a pedestrian**:
   `oneway=yes` restricts cars, not people. A way is one-way only with `oneway:foot`, or when it
   is itself a `footway`/`path`/`steps`/`pedestrian` tagged `oneway` (`-1` reverses it).
4. **Optimize** → `dist/optimized/navigation-graph-optimized.json`.
5. *(Optional)* `compress-coordinates.mjs` → `dist/navigation-graph-final.json`. The app does
   **not** load this variant.
6. **Ship** — copy it to `public/map/` by hand.

The graph format is a contract between the build scripts and `services/navigation.js` /
`navigationLoader.js`. Change one side — change and test the other in the same change.
`services/navigation.test.js` checks on the real graph that it's walkable both ways and connects
every pair of historical places.

`scripts/overpass/*.json|geojson` are tracked in git. `scripts/navigationGraph/dist/` is ignored.
