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

  // Theme manager
  import { getThemeManager } from "@/lib/theme/themeManager";

  // Points builder
  import { MapPointsBuilder } from "@/services/mapPointsBuilder";

  // Navigation
  import { initNavigation, findRoute, clearRouteCache } from "@/services/navigationLoader";

  // Components
  import NavigationControl from "@/components/Ui/NavigationControl.svelte";

  // Router
  import { goto } from "@mateothegreat/svelte5-router";

  import { articlesMeta } from "@/data/articles";

  // Error handler
  import { errorToast } from "@/store/ui/errorToast";
  import { ERROR_CODES } from "@/lib/errors/errorCodes";

  // Constants
  const PMTILES_PATH = "/map/tashkent_20251124.pmtiles";
  const PMTILES_KEY = "tashkent-local";
  const CITY_BOUNDARIES = "/map/tashkent_boundaries.geojson";

  const MARKER_CONFIG = {
    // Custom markers from MapPointsBuilder
    customMarkers: {
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

    // Offline navigation markers
    navigation: {
      start: {
        emoji: "🟢",
        className: "navigation-marker start-marker",
        label: "Start",
      },
      end: {
        emoji: "🔴",
        className: "navigation-marker end-marker",
        label: "End",
      },
    },
  };

  const BOUNDARY_CONFIG = {
    render: true,
    mapSource: [
      {
        boundaryName: "city-boundaries",
        type: "geojson",
        data: CITY_BOUNDARIES,
      },
    ],
    mapLayer: [
      {
        id: "city-boundary",
        source: "city-boundaries",
        lineColor: "#f56f32",
        lineWidth: 6,
      },
    ],
  };

  const MARKER_STYLE = {
    fontSize: "24px",
  };

  const MAP_BOUNDS = [
    [69.1038931009432, 41.144224013212],
    [69.5436061519978, 41.4359965669526],
  ];

  const INITIAL_VIEW = {
    center: [69.29, 41.3],
    zoom: 11,
    minZoom: 10,
    maxZoom: 17,
  };

  // State
  let { route, i18n } = $props();

  let mapContainer;
  let map;
  let protocol;
  let builder;

  // Coordinates
  let targetCoords = $state(null);

  // Themes
  let uiThemeStyle = $state("light");
  let styleVersion = 0;
  let unsubscribeTheme = null;
  const themeManager = getThemeManager();

  // Navigation state
  let navigationMode = $state(false);
  let navigationReady = $state(false);
  let navigationLoading = $state(false);
  let startPoint = $state(null);
  let endPoint = $state(null);
  let currentRoute = $state(null);
  let routeInfo = $state(null);

  // Markers for navigation points
  let startMarker = null;
  let endMarker = null;

  // Helper Functions

  /**
   * Create a navigation marker element
   */
  function createMarkerElement(type) {
    const config = MARKER_CONFIG.navigation[type];
    const el = document.createElement("div");

    el.className = config.className;
    el.innerHTML = config.emoji;
    Object.assign(el.style, MARKER_STYLE);

    return el;
  }

  /**
   * Add marker to map
   */
  function addMarker(lon, lat, type) {
    const el = createMarkerElement(type);
    return new maplibreGL.Marker({ element: el }).setLngLat([lon, lat]).addTo(map);
  }

  /**
   * Remove marker from map
   */
  function removeMarker(marker) {
    if (marker) {
      marker.remove();
      return null;
    }

    return marker;
  }

  /**
   * Set start point and marker
   */
  function setStartPoint(lon, lat) {
    startPoint = { lon, lat };
    startMarker = addMarker(lon, lat, "start");

    console.log("[Map] Start point set:", startPoint);
  }

  /**
   * Set end point and marker
   */
  function setEndPoint(lon, lat) {
    endPoint = { lon, lat };
    endMarker = addMarker(lon, lat, "end");

    console.log("[Map] End point set:", endPoint);
  }

  /**
   * Reset navigation and set new start point
   */
  function resetAndSetStart(lon, lat) {
    clearNavigation();
    setStartPoint(lon, lat);
  }

  // Navigation Functions

  /**
   * Handle map click in navigation mode
   */
  function handleMapClick(e) {
    if (!navigationMode || !navigationReady) return;

    const { lng, lat } = e.lngLat;

    // State machine for navigation point selection
    if (!startPoint) {
      setStartPoint(lng, lat);
    } else if (!endPoint) {
      setEndPoint(lng, lat);
      calculateRoute();
    } else {
      resetAndSetStart(lng, lat);
    }
  }

  /**
   * Toggle navigation mode
   */
  function toggleNavigationMode() {
    navigationMode = !navigationMode;

    if (navigationMode && !navigationReady && !navigationLoading) {
      loadNavigation();
    }

    if (!navigationMode) {
      clearNavigation();
    }
  }

  /**
   * Load navigation engine
   */
  async function loadNavigation() {
    if (navigationReady) return;

    navigationLoading = true;

    try {
      await initNavigation();
      navigationReady = true;
      console.log("[Map] Navigation ready");
    } catch (error) {
      console.error("[Map] Failed to load navigation:", error);

      errorToast.error($i18n.t("ui:errors:navigationInitFailed"), {
        scope: "Map",
        code: ERROR_CODES.NAV_INIT,
      });

      navigationMode = false;
    } finally {
      navigationLoading = false;
    }
  }

  /**
   * Clear all navigation state
   */
  function clearNavigation() {
    startPoint = null;
    endPoint = null;
    currentRoute = null;
    routeInfo = null;

    startMarker = removeMarker(startMarker);
    endMarker = removeMarker(endMarker);

    if (builder) {
      builder.clearNavigationRoute();
    }
  }

  /**
   * Calculate and display route
   */
  async function calculateRoute() {
    if (!startPoint || !endPoint) return;

    console.log("[Map] Calculating route...");

    // Show loading state
    routeInfo = { loading: true };

    // Small delay to let UI update
    await new Promise((resolve) => setTimeout(resolve, 100));

    try {
      const result = findRoute(startPoint.lon, startPoint.lat, endPoint.lon, endPoint.lat);

      if (result.success) {
        displayRoute(result);
      } else {
        handleRouteError(result);
      }
    } catch (error) {
      console.error("[Map] Route calculation error:", error);
      routeInfo = null;

      errorToast.error($i18n.t("ui:errors:navigationCalculateRouteFailed"), {
        scope: "Map",
        code: ERROR_CODES.NAV_ROUTE_CALC,
      });
    }
  }

  /**
   * Display calculated route on map
   */
  function displayRoute(result) {
    currentRoute = result.route;
    routeInfo = {
      distance: result.route.properties.distance,
      nodes: result.route.properties.nodes,
      computeTime: result.route.properties.computeTime,
      iterations: result.route.properties.iterations,
    };

    builder.addNavigationRoute(currentRoute);
    fitMapToRoute(currentRoute);

    console.log("[Map] Route calculated:", routeInfo);
  }

  /**
   * Handle route calculation error
   */
  function handleRouteError(result) {
    routeInfo = null;

    errorToast.error($i18n.t("ui:errors:navigationRouteNotFound"), {
      scope: "Map",
      code: ERROR_CODES.NAV_ROUTE_NOT_FOUND,
    });

    console.error("[Map] Route calculation failed:", result.message);
  }

  /**
   * Fit map bounds to show entire route
   */
  function fitMapToRoute(route) {
    const coordinates = route.geometry.coordinates;
    const bounds = coordinates.reduce(
      (bounds, coord) => {
        return bounds.extend(coord);
      },
      new maplibreGL.LngLatBounds(coordinates[0], coordinates[0]),
    );

    map.fitBounds(bounds, {
      padding: { top: 100, bottom: 100, left: 100, right: 100 },
    });
  }

  // Route Resolution

  function resolveTargetCoordsFromRoute(value) {
    const qs = value?.result?.querystring?.params;
    if (!qs) return null;

    const lon = parseFloat(qs.lon);
    const lat = parseFloat(qs.lat);

    if (Number.isNaN(lon) || Number.isNaN(lat)) return null;

    return [lon, lat];
  }

  // svelte-ignore state_referenced_locally
  targetCoords = resolveTargetCoordsFromRoute(route);

  // Map Initialization

  /**
   * Build map style
   */
  async function buildStyleForTheme(theme) {
    const origin = window.location.origin;

    return buildBaseMapStyle({
      origin,
      pmtilesKey: PMTILES_KEY,
      theme,
      lang: `${$i18n.language}`,
      fontstack: "Roboto Regular",
    });
  }

  /**
   * Apply theme to map and restore overlays
   * @param {string} theme - Theme name ('light' or 'dark')
   * @returns {Promise<void>}
   */
  async function applyThemeToMap(theme) {
    if (!map) {
      console.warn("[Map] Cannot apply theme: map not initialized");
      return;
    }

    try {
      uiThemeStyle = theme;

      startMarker = removeMarker(startMarker);
      endMarker = removeMarker(endMarker);

      styleVersion += 1;
      const myVersion = styleVersion;

      const style = await buildStyleForTheme(uiThemeStyle);
      map.setStyle(style);

      const onIdle = () => {
        if (myVersion !== styleVersion) return;

        map.off("idle", onIdle);

        builder.setStyleVersion(myVersion);
        reapplyOverlaysAfterStyleChange();

        if (startPoint) startMarker = addMarker(startPoint.lon, startPoint.lat, "start");
        if (endPoint) endMarker = addMarker(endPoint.lon, endPoint.lat, "end");
      };

      map.on("idle", onIdle);
    } catch (error) {
      console.error("[Map] Failed to apply theme:", error);

      errorToast.error($i18n.t("ui:errors:mapThemeFailed"), {
        scope: "Map",
        code: ERROR_CODES.MAP_THEME_FAILED,
      });
    }
  }

  /**
   * Initialize PMTiles source
   */
  async function initializePMTiles() {
    const response = await fetch(PMTILES_PATH);

    if (!response.ok) {
      console.error(`Failed to fetch PMTiles: ${response.status} ${response.statusText}`);

      errorToast.error($i18n.t("ui:errors:mapPMTilesFetch"), {
        scope: "Map",
        code: ERROR_CODES.PMTILES_FETCH,
      });
    }

    const buffer = await response.arrayBuffer();
    const src = new InMemoryPMTilesSource(PMTILES_KEY, buffer);
    const pmtiles = new PMTiles(src);

    protocol = new Protocol();
    maplibreGL.addProtocol("pmtiles", protocol.tile);
    protocol.add(pmtiles);

    return pmtiles;
  }

  /**
   * Create and configure MapPointsBuilder instance
   *
   * This function initializes the map points builder with all necessary
   * configuration for displaying article markers, labels, city boundaries,
   * and handling user interactions.
   *
   * @param {number} version - Current style version (increments on theme changes)
   * @returns {MapPointsBuilder} - Configured builder instance
   */
  function createMapPointsBuilder(version) {
    return (
      MapPointsBuilder.create()
        // Core configuration
        .withMap(map)
        .withData(articlesMeta)
        .withStyleVersion(version)

        // i18n translations for UI elements
        .withI18n({
          title: (item) => $i18n.t(`articles:${item.id}:title`),
          popupLink: () => $i18n.t("ui:buttons:readMore"),
          popupGetOtherMaps: () => $i18n.t("ui:buttons:popupGetOtherMaps"),
        })

        // SPA routing integration
        .withRouter((id) => goto(`/articles/${id}`))

        // Markers configuration (custom icon and labels)
        .withMarkers(MARKER_CONFIG.customMarkers)

        // City boundary configuration
        .withCityBoundaries(BOUNDARY_CONFIG)

        // Finalize and validate configuration
        .build()
    );
  }

  /**
   * Reapply all map overlays after style change
   * (boundaries, markers, routes, event handlers)
   */
  function reapplyOverlaysAfterStyleChange() {
    if (!map || !builder) return;

    map.setMaxBounds(MAP_BOUNDS);

    builder.addCityBoundaryLayer();
    builder.addMarkers();

    if (currentRoute) builder.addNavigationRoute(currentRoute);

    // click handler можно не трогать, но если хочешь — оставь:
    map.off("click", handleMapClick);
    map.on("click", handleMapClick);
  }

  function setupMapHandlers() {
    reapplyOverlaysAfterStyleChange();

    // Fly to coodrinates
    if (targetCoords) {
      map.flyTo({
        center: targetCoords,
        zoom: 16,
      });
    }
  }

  // Lifecycle

  onMount(async () => {
    try {
      await initializePMTiles();

      uiThemeStyle = themeManager.getState().isDark ? "dark" : "light";
      const style = await buildStyleForTheme(uiThemeStyle);

      map = new maplibreGL.Map({
        container: mapContainer,
        style,
        ...INITIAL_VIEW,
      });

      styleVersion += 1;
      builder = createMapPointsBuilder(styleVersion);
      map.on("load", setupMapHandlers);

      unsubscribeTheme = themeManager.subscribe(({ isDark }) => {
        const next = isDark ? "dark" : "light";
        if (next === uiThemeStyle) return;

        applyThemeToMap(next);
      });
    } catch (error) {
      console.error("[Map] Initialization failed:", error);

      errorToast.error($i18n.t("ui:errors:mapInitFailed"), {
        scope: "Map",
        code: ERROR_CODES.MAP_INIT_FAILED,
      });
    }
  });

  onDestroy(() => {
    if (map) {
      map.remove();
      map = null;
    }

    if (protocol) {
      maplibreGL.removeProtocol("pmtiles");
      protocol = null;
    }

    startMarker = removeMarker(startMarker);
    endMarker = removeMarker(endMarker);

    unsubscribeTheme?.();
    unsubscribeTheme = null;

    if (builder) {
      builder.dispose();
      builder = null;
    }
  });

  $effect(() => {
    const result = route?.result;
    const pageKey = resolvePageKeyFromRouteResult(result);
    const title = pageKey ? $i18n.t(`ui:navbar:${pageKey}:title`) : "";

    const dispose = withNavbar({
      title: title || pageKey,
      leftSnippet: null,
      rightSnippet: null,
      subnavSnippet: null,
    });

    return dispose;
  });
</script>

<section class="map-section">
  <div bind:this={mapContainer} class="map-container"></div>

  <!-- Navigation Control Component -->
  <div class="navigation-control-wrapper">
    <NavigationControl
      bind:navigationMode
      {i18n}
      {navigationReady}
      {navigationLoading}
      {routeInfo}
      onToggle={toggleNavigationMode}
      onClear={clearNavigation}
    />
  </div>
</section>

<style>
  .map-section {
    width: 100%;
    height: 100%;
    display: grid;
    grid-template-columns: 1fr;
    padding-left: 1rem;
    padding-right: 1rem;
    padding-bottom: 1rem;
    position: relative;
  }

  .map-container {
    width: 100%;
    height: 100%;
    border-radius: 1.5rem;
    background-color: var(--ios-light-surface-1);
  }

  :global(.dark) .map-container {
    background-color: var(--ios-dark-surface-1);
  }

  .navigation-control-wrapper {
    position: absolute;
    top: 0.6rem;
    right: 1.6rem;
    z-index: 10;
  }

  :global(.navigation-marker) {
    cursor: pointer;
    user-select: none;
  }
</style>
