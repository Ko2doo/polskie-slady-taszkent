---
paths:
  - "public/map/**"
  - "public/fonts/map/**"
  - "scripts/**"
  - "src/services/mapStyle.js"
  - "src/services/navigationLoader.js"
  - "src/views/Map/MapLifecycle.svelte.js"
  - "src/views/Map/MapConstants.js"
  - "src/utils/inMemoryPmtilesSource.js"
---

# Offline map and navigation data pipeline

The app works fully offline, so everything the map and the router need ships inside the app
bundle under `public/`. None of it is fetched from the internet at runtime. This file covers
what those assets are, which code consumes them, and how each one is (re)produced. Runtime
behavior of the router itself is in `.claude/rules/navigation-subsystem.md`.

## Runtime assets (`public/`, all tracked in git)

| Asset | Consumed by | Produced by |
| --- | --- | --- |
| `public/map/tashkent_<YYYYMMDD>.pmtiles` | `views/Map/MapLifecycle.svelte.js` (`initializePMTiles`), path in `MapConstants.js` `PMTILES_PATH` | Not scripted in this repo (a Protomaps/PMTiles extract of Tashkent) |
| `public/map/navigation-graph-optimized.json` | `services/navigationLoader.js` (lazy `fetch`) | `scripts/navigationGraph/` (below) |
| `public/map/tashkent_boundaries.geojson` | `MapConstants.js` `CITY_BOUNDARIES` (city-boundary layer) | Not scripted |
| `public/map/sprites/{light,dark}/*` | `services/mapStyle.js` (`sprite` url) | `npm run map:download-sprites` |
| `public/fonts/map/<fontstack>/<range>.pbf` | `services/mapStyle.js` (`glyphs` url); every text layer is forced to one fontstack, `Roboto Regular` | Not scripted (pre-generated glyph PBFs) |
| `public/map/icons/*.png` (`.svg` sources beside them) | `MapConstants.js` (point, GPS, arrow icons) | Hand-made |

### How the tiles are served

`initializePMTiles` fetches the whole `.pmtiles` archive **once** into an `ArrayBuffer` and
wraps it in `utils/inMemoryPmtilesSource.js` (`InMemoryPMTilesSource`, which implements
pmtiles' `Source` interface: `getKey()` + `getBytes(offset, length)`). This is deliberate:
Capacitor's local web server / `file://` doesn't reliably support HTTP Range requests, which
the default pmtiles `FetchSource` relies on. The trade-off is RAM — the archive lives in
memory for the map's lifetime — so **keep the `.pmtiles` file small** (city bbox only, sane
max zoom). Any new or larger extract is a performance change, see `harness/performance.md`.
The protocol is registered as `pmtiles://` with key `PMTILES_KEY` and removed on teardown —
reference-counted in `MapLifecycle.svelte.js`, because a map screen left while still loading
is cleaned up late, possibly after the next screen registered its own; only the last cleanup
removes it.

### How the style is built

The MapLibre style JSON is **built at runtime** by `services/mapStyle.js` from
`@protomaps/basemaps` (`layers`/`namedFlavor`) per theme and language, pointing at the local
glyphs and sprites above. There is no static style file in `public/`.
`scripts/generateMaplibreBaseStyle.mjs` (writes to `public/map/styles/`, which doesn't
exist) is an older alternative to that runtime approach and is not part of the current
pipeline. Leave it as is — `scripts/` is hands-off (see `.claude/rules/repository-layout.md`).

## The navigation graph pipeline (`scripts/overpass/` → `scripts/navigationGraph/`)

Steps (also in `scripts/navigationGraph/instructions.txt`), run from the repo root:

1. **Fetch roads** — `scripts/overpass/query.overpass` is an Overpass QL query for walkable
   `highway=*` ways in the Tashkent bbox (`41.167,69.117,41.42,69.525`).
   `scripts/overpass/curl-commands.txt` POSTs it to overpass-api.de →
   `tashkent_roads.json`.
2. **Convert** — `npx osmtogeojson tashkent_roads.json > tashkent_roads.geojson` (a global
   CLI tool, not a project dependency; don't add it to `package.json`).
3. **Build** — `node scripts/navigationGraph/build-navigation-graph.mjs` →
   `scripts/navigationGraph/dist/navigation-graph.json` and
   `scripts/navigationGraph/dist/navigation-graph-compact.json`
   (`{ nodes, edges }`, nodes deduplicated by coordinates rounded to 6 decimals). Edges are
   directed; every way gets both directions **for a pedestrian**: OSM `oneway=yes` on a road
   restricts vehicles, not people on foot, so a way is one-way only with `oneway:foot`, or
   when it is itself a `footway`/`path`/`steps`/`pedestrian` tagged `oneway` (`-1` reverses
   it). `navigation.test.js` checks the shipped graph stays walkable both ways and connects
   every pair of historical places.
4. **Optimize** — `optimize-graph.mjs` → `dist/optimized/navigation-graph-optimized.json`.
5. *(Optional)* `compress-coordinates.mjs` → `dist/navigation-graph-final.json`. The app
   does **not** currently load this variant.
6. **Ship** — copy `dist/optimized/navigation-graph-optimized.json` to
   `public/map/navigation-graph-optimized.json` by hand.

`scripts/overpass/*.json|geojson` are tracked; `scripts/navigationGraph/dist/` is ignored
(matches the root `.gitignore`'s `dist` rule).

### Rules for touching this pipeline

The scripts themselves are hands-off unless explicitly asked (see
`.claude/rules/repository-layout.md`); the rules below apply when that happens.

- The graph's JSON shape is a contract between `build`/`optimize-graph.mjs` and
  `services/navigation.js`/`navigationLoader.js`. Changing one side means changing (and
  testing) the other in the same change.
- Scripts here are developer tools run on the developer's machine. They may use
  `console.log` (the app-code logging rule in `harness/code-style.md` doesn't apply) and may
  hit the network; the app itself never does.
- Fetching from overpass-api.de or GitHub is an external network action — the agent only
  runs these steps when explicitly asked to refresh the data.
- Regenerated data files are large; only regenerate them when the task is specifically
  "refresh map/graph data", and say so in the step summary.
