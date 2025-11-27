<script>
  /**
   * Documentation:
   *
   * From style.json specifications: https://docs.mapbox.com/style-spec/reference/
   * From MapLibre docs: https://maplibre.org/maplibre-gl-js/docs/
   * Leaflet migration guide: https://maplibre.org/maplibre-gl-js/docs/guides/leaflet-migration-guide/
   * GeoJson: https://overpass-turbo.eu/
   *
   * overpass-turbo code:
   * [out:json][timeout:60];
   * rel
   *  ["boundary"="administrative"]
   *  ["admin_level"="8"]
   *  ["name"="Tashkent"];
   * out body;
   * >;
   * out skel qt;
   *
   * or https://overpass-api.de/api/interpreter?data=[out:json][timeout:60];rel(2216724);out%20body;>;out%20skel%20qt;
   *
   *
   * Get sprites json https://docs.mapbox.com/api/maps/styles/#retrieve-a-sprite-image-or-json
   * Sprite doc: https://docs.mapbox.com/style-spec/reference/sprite/
   */

  import { onMount, onDestroy } from "svelte";

  // Navbar stores and helpers
  import { resolvePageKeyFromRouteResult } from "@/utils/routerUtils";
  import { withNavbar } from "@/store/ui/navbar";

  // Map libraries
  import maplibreGL from "maplibre-gl";
  import { PMTiles, Protocol } from "pmtiles";
  import { InMemoryPMTilesSource } from "@/utils/inMemoryPmtilesSource";

  // Sources
  const PMTILES_PATH = "/map/Tashkent_251120.pmtiles";
  const PMTILES_KEY = "tashkent-local"; // public/map/style_tashkent.json pmtiles://tashkent-local
  const BASE_STYLE = "/map/styles/style.light.ru.json";
  const GEOJSON = "/map/Tashkent.geojson";

  let { route, i18n } = $props();

  let mapContainer;
  let map;
  let protocol;

  // onMount(async () => {
  //   // 1. writting full .pmtiles file
  //   const response = await fetch(PMTILES_PATH);

  //   if (!response.ok) {
  //     console.error("Failed to fetch PMTiles:", response.status, response.statusText);
  //     return;
  //   }

  //   const buffer = await response.arrayBuffer();

  //   // 2. Create in-memory source PMTiles
  //   const src = new InMemoryPMTilesSource(PMTILES_KEY, buffer);
  //   const pmtiles = new PMTiles(src);

  //   // 3 Registration protocol and PMTiles instance
  //   protocol = new Protocol();
  //   maplibreGL.addProtocol("pmtiles", protocol.tile);
  //   protocol.add(pmtiles);

  //   // 4. Create map
  //   map = new maplibreGL.Map({
  //     container: mapContainer,
  //     style: {
  //       version: 8,
  //       sources: {},
  //       layers: [],
  //     },

  //     minZoom: 10,
  //     maxZoom: 18,
  //   });

  //   map.setStyle(BASE_STYLE, {
  //     transformStyle: (style) => {
  //       const origin = window.location.origin;

  //       // полные URL до локальных спрайтов и глифов
  //       style.sprite = `${origin}/map/sprites/light/light`;
  //       style.glyphs = `${origin}/fonts/map/{fontstack}/{range}.pbf`;

  //       return style;
  //     },

  //     diff: false,
  //   });

  //   // Add GeoJson boundaries
  //   map.on("load", () => {
  //     map.addSource("geojson-source", {
  //       type: "geojson",
  //       data: GEOJSON,
  //     });

  //     map.addLayer({
  //       id: "geojson-layer",
  //       type: "line",
  //       source: "geojson-source",
  //       paint: {
  //         "line-color": "#f56f32",
  //         "line-width": 6,
  //       },
  //     });
  //   });
  // });

  onMount(async () => {
    // 1. parralel loading PMTiles and style.json
    const [pmtilesResponse, styleResponse] = await Promise.all([fetch(PMTILES_PATH), fetch(BASE_STYLE)]);

    if (!pmtilesResponse.ok) {
      console.error("Failed to fetch PMTiles:", pmtilesResponse.status, pmtilesResponse.statusText);
      return;
    }

    if (!styleResponse.ok) {
      console.error("Failed to fetch base style:", styleResponse.status, styleResponse.statusText);
      return;
    }

    // 2. Reading data PMTiles in memory
    const buffer = await pmtilesResponse.arrayBuffer();
    const src = new InMemoryPMTilesSource(PMTILES_KEY, buffer);
    const pmtiles = new PMTiles(src);

    protocol = new Protocol();
    maplibreGL.addProtocol("pmtiles", protocol.tile);
    protocol.add(pmtiles);

    // 3. Reading style.json with object and patching sprite/glyphs
    const rawStyle = await styleResponse.json();

    // Clone
    const style = structuredClone ? structuredClone(rawStyle) : JSON.parse(JSON.stringify(rawStyle));

    const origin = window.location.origin;

    // Structure:
    // public/map/sprites/light/light.{json,png}
    style.sprite = `${origin}/map/sprites/light/light@2x`;

    // local glyphs Roboto
    style.glyphs = `${origin}/fonts/map/{fontstack}/{range}.pbf`;

    // 4. Create map
    map = new maplibreGL.Map({
      container: mapContainer,
      style,
      center: [69.25, 41.3],
      zoom: 11,
      minZoom: 10,
      maxZoom: 18,
    });

    // 5. Add GeoJSON after map loading
    map.on("load", () => {
      map.addSource("geojson-source", {
        type: "geojson",
        data: GEOJSON,
      });

      // Add city boundary
      map.addLayer({
        id: "city-boundary",
        type: "line",
        source: "geojson-source",
        paint: {
          "line-color": "#f56f32",
          "line-width": 6,
        },
      });
    });
  });

  onDestroy(() => {
    if (map) map.remove();
    if (protocol) maplibreGL.removeProtocol("pmtiles");
  });

  $effect(() => {
    const result = route?.result;

    // get "pageKey" from route path
    //    "/about" -> "about"
    //    "/handbook" -> "handbook"
    const pageKey = resolvePageKeyFromRouteResult(result);

    /* prettier-ignore */
    const title = pageKey
      ? $i18n.t(`ui:navbar:${pageKey}:title`)
      : "";

    const dispose = withNavbar({
      title: title || pageKey,
      leftSnippet: null,
      rightSnippet: null,
      subnavSnippet: null,
    });

    return dispose;
  });
</script>

<section bind:this={mapContainer} class="w-full h-full"></section>
