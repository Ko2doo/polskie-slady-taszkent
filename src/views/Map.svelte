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

  // Style generation services
  import { buildBaseMapStyle } from "@/services/mapStyle";

  // Points builder
  import { MapPointsBuilder } from "@/services/mapPointsBuilder";

  // Router
  import { goto } from "@mateothegreat/svelte5-router";

  // Sources
  const PMTILES_PATH = "/map/tashkent_20251124.pmtiles";
  const PMTILES_KEY = "tashkent-local"; // public/map/style_tashkent.json pmtiles://tashkent-local
  const CITY_BOUNDARIES = "/map/tashkent_boundaries.geojson";

  import { articlesMeta } from "@/data/articles";
  import { render } from "svelte/server";

  let { route, i18n } = $props();

  let mapContainer;
  let map;
  let protocol;

  onMount(async () => {
    // 1. Loading full PMTiles-file
    const response = await fetch(PMTILES_PATH);

    if (!response.ok) {
      console.error("Failed to fetch PMTiles:", response.status, response.statusText);
      return;
    }

    // 2. Create in-memory data PMTiles
    const buffer = await response.arrayBuffer();
    const src = new InMemoryPMTilesSource(PMTILES_KEY, buffer);
    const pmtiles = new PMTiles(src);

    // 3. Protocol pmtiles:// registration
    protocol = new Protocol();
    maplibreGL.addProtocol("pmtiles", protocol.tile);
    protocol.add(pmtiles);

    // 4. Building runtime-style with @protomaps/basemaps
    const origin = window.location.origin;

    const style = buildBaseMapStyle({
      origin,
      pmtilesKey: PMTILES_KEY,
      theme: "light",
      lang: `${$i18n.language}`,
      fontstack: "Roboto Regular",
    });

    // 5. Create map
    map = new maplibreGL.Map({
      container: mapContainer,
      style,
      center: [69.29, 41.3],
      zoom: 11,
      minZoom: 10,
      maxZoom: 17,
    });

    // 5. Add GeoJSON after map loading
    // Map pointer data
    const builder = new MapPointsBuilder({
      currentMap: map,
      data: articlesMeta,
      i18n: {
        // title for point label
        title: (item) => $i18n.t(`articles:${item.id}:title`),
        popupLink: () => $i18n.t("ui:buttons:readMore"),
      },
      routeFunc: (id) => goto(`/articles/${id}`),

      // Markers
      markers: {
        render: true,
        icon: {
          name: "article",
          url: "/map/icons/pointIcon.png",
        },
        mapSource: [{ pointSourceName: "articles-points-source", type: "geojson" }],
        mapLayer: [
          {
            id: "articles-points-layer",
            type: "symbol",
            source: "articles-points-source",
            // minzoom: 11.5,
            layout: {
              "icon-image": "article-point",
              "icon-size": 0.38,
              "icon-allow-overlap": true,
            },
          },
          {
            id: "articles-labels-layer",
            type: "symbol",
            source: "articles-points-source",
            minzoom: 12.5,
            layout: {
              "text-field": ["get", "title"],
              "text-size": 12,
              "text-offset": [0, 1.2],
              "text-anchor": "top",
              "text-allow-overlap": false,
              "icon-optional": true,
            },
            paint: {
              "text-color": "#111111",
              "text-halo-color": "#ffffff",
              "text-halo-width": 1.5,
            },
          },
        ],
        listener: {
          iconLayerId: "articles-points-layer",
          labelLayerId: "articles-labels-layer",
        },
      },

      // City boundary
      cityBoundaries: {
        render: true,
        mapSource: [{ boundaryName: "city-boundaries", type: "geojson", data: CITY_BOUNDARIES }],
        mapLayer: [
          {
            id: "city-boundary",
            source: "city-boundaries",
            lineColor: "#f56f32",
            lineWidth: 6,
          },
        ],
      },
    });

    map.on("load", () => {
      builder.addCityBoundaryLayer();
      builder.addMarkers();
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

<section class="w-full h-full grid grid-cols-1 md:grid-cols-1 pl-4 pr-4 pb-4">
  <div
    bind:this={mapContainer}
    class="w-full h-full rounded-3xl bg-ios-light-surface-1 dark:bg-ios-dark-surface-1"
  ></div>
</section>
