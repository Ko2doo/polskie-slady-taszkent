<script>
  /**
   * Documentation:
   *
   * From style.json specifications: https://docs.mapbox.com/style-spec/reference/
   * From MapLibre docs: https://maplibre.org/maplibre-gl-js/docs/
   * Leaflet migration guide: https://maplibre.org/maplibre-gl-js/docs/guides/leaflet-migration-guide/
   */

  import { onMount, onDestroy } from "svelte";

  // Map libraries
  import maplibreGL from "maplibre-gl";
  import { PMTiles, Protocol } from "pmtiles";
  import { InMemoryPMTilesSource } from "@/utils/inMemoryPmtilesSource";

  // Sources
  const PMTILES_PATH = "/map/Tashkent_251120.pmtiles";
  const PMTILES_KEY = "tashkent-local"; // public/map/style_tashkent.json pmtiles://tashkent-local
  const STYLE_URL = "/map/style_tashkent.json";
  const GEOJSON = "/map/Tashkent_251120.geo.json";

  let { i18n } = $props();

  let mapContainer;
  let map;
  let protocol;

  onMount(async () => {
    // 1. writting full .pmtiles file
    const response = await fetch(PMTILES_PATH);

    if (!response.ok) {
      console.error("Failed to fetch PMTiles:", response.status, response.statusText);
      return;
    }

    const buffer = await response.arrayBuffer();

    // 2. Create in-memory source PMTiles
    const src = new InMemoryPMTilesSource(PMTILES_KEY, buffer);
    const pmtiles = new PMTiles(src);

    // 3 Registration protocol and PMTiles instance
    protocol = new Protocol();
    maplibreGL.addProtocol("pmtiles", protocol.tile);
    protocol.add(pmtiles);

    // 4. Create map
    map = new maplibreGL.Map({
      container: mapContainer,
      style: STYLE_URL,
      center: [69.28, 41.3],
      zoom: 12,
      minZoom: 10,
      maxZoom: 20,
    });

    // Add GeoJson boundaries
    map.on("load", () => {
      map.addSource("geojson-source", {
        type: "geojson",
        data: GEOJSON,
      });

      map.addLayer({
        id: "geojson-layer",
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
</script>

<section bind:this={mapContainer} class="w-full h-full"></section>
