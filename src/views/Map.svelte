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

  // Router
  import { goto } from "@mateothegreat/svelte5-router";

  // Sources
  const PMTILES_PATH = "/map/tashkent_20251124.pmtiles";
  const PMTILES_KEY = "tashkent-local"; // public/map/style_tashkent.json pmtiles://tashkent-local
  const CITY_BOUNDARIES = "/map/tashkent_boundaries.geojson";

  import { articlesMeta } from "@/data/articles";

  let { route, i18n } = $props();

  let mapContainer;
  let map;
  let protocol;

  function openArticle(id) {
    goto(`/articles/${id}`);
  }

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
    map.on("load", () => {
      map.addSource("city-boundaries", {
        type: "geojson",
        data: CITY_BOUNDARIES,
      });

      // Add city boundary
      map.addLayer({
        id: "city-boundary",
        type: "line",
        source: "city-boundaries",
        paint: {
          "line-color": "#f56f32",
          "line-width": 6,
        },
      });

      // Add points
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        if (!map.hasImage("article-point")) {
          map.addImage("article-point", img);
        }

        const features = articlesMeta
          .map((article) => {
            const coords = article.coords;

            if (!coords || coords.length !== 2) return null;

            const title = $i18n.t(`articles:${article.id}:title`);

            return {
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: coords,
              },
              properties: {
                id: article.id,
                title: title,
              },
            };
          })
          .filter(Boolean);

        const sourceData = {
          type: "FeatureCollection",
          features,
        };

        // Points
        map.addSource("articles-points-source", {
          type: "geojson",
          data: sourceData,
        });

        // Layer with icons
        map.addLayer({
          id: "articles-points-layer",
          type: "symbol",
          source: "articles-points-source",
          layout: {
            "icon-image": "article-point",
            "icon-size": 0.42,
            "icon-allow-overlap": true,
          },
        });

        // Layers with title
        map.addLayer({
          id: "articles-labels-layer",
          type: "symbol",
          source: "articles-points-source",
          minzoom: 13.5,
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
        });

        // Popup with click points
        map.on("click", "articles-points-layer", (e) => {
          const feature = e.features && e.features[0];
          if (!feature) return;

          const coords = feature.geometry.coordinates;
          const { id, title } = feature.properties;

          // Popup init
          const popup = new maplibreGL.Popup({
            closeButton: false, // disable default button
            closeOnClick: true,
          }).setLngLat(coords);

          // Custom popup params
          const container = document.createElement("div");
          container.className = "map-popup";

          // Popup inner content
          container.innerHTML = `
            <div class="flex justify-end mb-1">
              <button
                type="button"
                class="map-popup-close cursor-pointer w-7 h-7 flex items-center justify-center rounded-full bg-white/80 text-xs font-bold shadow"
                aria-label="Close"
              >&times;</button>
            </div>
            <div class="text-sm">
              <p class="w-full text-gray-900 dark:text-gray-900 text-base font-medium sm:font-bold">${title}</p><br/>
              <a class="w-full text-blue-500 dark:text-blue-500 text-base" href="/articles/${id}" data-article-id="${id}">
                ${$i18n.t("ui:buttons:readMore")}
              </a>
            </div>
          `;

          // Close button
          const closeBtn = container.querySelector(".map-popup-close");
          if (closeBtn) {
            closeBtn.addEventListener("click", () => {
              popup.remove();
            });
          }

          // Routing link
          const link = container.querySelector("a");
          if (link) {
            link.addEventListener("click", (event) => {
              event.preventDefault();
              openArticle(id);
              popup.remove();
            });
          }

          // Create popup with map
          popup.setDOMContent(container).addTo(map);
        });
      };

      img.onerror = (e) => {
        console.error("Failed to load icon image:", e);
      };

      // Add icon
      img.src = "/map/icons/pointIcon.png";
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

<section class="w-full h-full">
  <div bind:this={mapContainer} class="w-full h-full"></div>
</section>
