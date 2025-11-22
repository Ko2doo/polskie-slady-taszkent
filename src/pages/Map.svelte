<script>
  import { onMount } from "svelte";
  import { Capacitor } from "@capacitor/core";

  // i18n imports
  import { i18nStores } from "@/services/i18n";
  const { i18n } = i18nStores;

  // Map imports
  import * as L from "leaflet";
  import { leafletLayer } from "protomaps-leaflet";

  // GeoJson with bordered city
  import tashkentGeoData from "@/data/Tashkent_251120.geo.json";

  let mapContainer = $state(null);
  let map = $state(null); // map state

  const PMFILES_PATH = "/map/Tashkent_251120.pmtiles";

  onMount(() => {
    if (!mapContainer) return;

    // Map initialization params
    const leafletMap = L.map(mapContainer, {
      center: [41.3, 69.28],
      zoom: 12,
      minZoom: 11.2,
      maxZoom: 20,
      worldCopyJump: false,
    });

    // City borders
    const boundaryLayer = L.geoJSON(tashkentGeoData, {
      style: {
        color: "#ff3b30",
        weight: 4,
        opacity: 0.9,
        fill: false,
      },
    });

    const cityBounds = boundaryLayer.getBounds(); // LatLngBounds из GeoJSON

    // painting administrative borders
    boundaryLayer.addTo(leafletMap);

    leafletMap.fitBounds(cityBounds);
    leafletMap.setMaxBounds(cityBounds.pad(0.02));

    // Correctly path with PMTiles
    let pmtilesURL = Capacitor.convertFileSrc(PMFILES_PATH);

    console.log("Loading PMTiles:", pmtilesURL);

    // Base vector layer with Tashkent.pmtiles
    const baseLayer = leafletLayer({
      url: pmtilesURL,

      // theme and lang
      flavor: "light",
      lang: $i18n.language,

      attribution: "© OpenStreetMap contributors, Protomaps",
    });

    baseLayer.addTo(leafletMap);

    // save
    map = leafletMap;

    // Cleanup
    return () => leafletMap.remove();
  });
</script>

<section bind:this={mapContainer} class="w-full h-full"></section>
