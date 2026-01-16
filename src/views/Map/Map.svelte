<script>
  /**
   * Map View Component
   *
   * Interactive map view with article markers, city boundaries, and navigation.
   *
   * Features:
   * - Displays article locations as clickable markers
   * - City boundary visualization
   * - Light/Dark theme support
   * - Offline navigation with A* pathfinding
   * - Deep linking support (?lon=X&lat=Y)
   *
   * Architecture:
   * - MapConstants.js - Configuration constants
   * - MapBuilder.svelte.js - MapPointsBuilder configuration
   * - MapNavigation.svelte.js - Navigation logic
   * - MapTheme.svelte.js - Theme management
   * - MapLifecycle.svelte.js - Initialization and cleanup
   */

  import { onMount, onDestroy } from "svelte";
  import { goto } from "@mateothegreat/svelte5-router";

  // Navbar
  import { resolvePageKeyFromRouteResult } from "@/utils/routerUtils";
  import { withNavbar } from "@/store/ui/navbar";

  // Data
  import { articlesMeta } from "@/data/articles";

  // Error handling
  import { errorToast } from "@/store/ui/errorToast";
  import { ERROR_CODES } from "@/lib/errors/errorCodes";

  // Components
  import NavigationControl from "@/components/Ui/NavigationControl.svelte";

  // Map modules
  import { createMapPointsBuilder } from "./MapBuilder.svelte.js";
  import { createNavigationController } from "./MapNavigation.svelte.js";
  import { createThemeController } from "./MapTheme.svelte.js";
  import {
    initializePMTiles,
    initializeMap,
    setupMapHandlers,
    cleanupMap,
    resolveTargetCoords,
  } from "./MapLifecycle.svelte.js";

  // ========================================
  // PROPS
  // ========================================

  let { route, i18n } = $props();

  // ========================================
  // STATE
  // ========================================

  let mapContainer;
  let map = null;
  let protocol = null;
  let builder = null;
  let navigation = $state(null);
  let theme = null;

  // Target coordinates from URL params (?lon=X&lat=Y)
  let targetCoords = $state(null);

  // ========================================
  // DERIVED STATE
  // ========================================

  // Resolve target coordinates from route
  $effect(() => {
    targetCoords = resolveTargetCoords(route);
  });

  // ========================================
  // LIFECYCLE - MOUNT
  // ========================================

  onMount(async () => {
    console.log("[Map] Mounting...");

    try {
      // 1. Load PMTiles
      protocol = await initializePMTiles($i18n);

      // 2. Initialize theme controller (without map yet)
      theme = createThemeController({
        map: null, // Will be set after map creation
        builder: null,
        navigation: null,
        i18n: $i18n,
      });

      const initialTheme = theme.init();

      // 3. Build initial style
      const style = await theme.buildStyleForTheme(initialTheme);

      // 4. Create map instance
      map = initializeMap({
        container: mapContainer,
        style,
      });

      // 5. Create MapPointsBuilder
      builder = createMapPointsBuilder({
        map,
        data: articlesMeta,
        i18n: $i18n,
        routeFunc: (id) => goto(`/articles/${id}`),
        styleVersion: theme.styleVersion,
      });

      // 6. Create navigation controller
      navigation = createNavigationController({
        map,
        builder,
        i18n: $i18n,
      });

      // 7. Update theme controller with instances
      theme = createThemeController({
        map,
        builder,
        navigation,
        i18n: $i18n,
      });
      theme.init();

      // 8. Setup map handlers when map loads
      map.on("load", () => {
        setupMapHandlers({
          map,
          builder,
          navigation,
          targetCoords,
        });
      });

      console.log("[Map] Initialization complete");
    } catch (error) {
      console.error("[Map] Initialization failed:", error);

      errorToast.error($i18n.t("ui:errors:mapInitFailed"), {
        scope: "Map",
        code: ERROR_CODES.MAP_INIT_FAILED,
      });
    }
  });

  // ========================================
  // LIFECYCLE - UNMOUNT
  // ========================================

  onDestroy(() => {
    console.log("[Map] Unmounting...");

    cleanupMap({
      map,
      protocol,
      builder,
      navigation,
      theme,
    });

    // Nullify references
    map = null;
    protocol = null;
    builder = null;
    navigation = null;
    theme = null;
  });

  // ========================================
  // NAVBAR CONFIGURATION
  // ========================================

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
  <!-- Map container -->
  <div bind:this={mapContainer} class="map-container"></div>

  <!-- Navigation control overlay -->
  {#if navigation}
    <div class="navigation-control-wrapper">
      <NavigationControl
        bind:navigationMode={navigation.navigationMode}
        {i18n}
        navigationReady={navigation.navigationReady}
        navigationLoading={navigation.navigationLoading}
        routeInfo={navigation.routeInfo}
        onToggle={navigation.toggleNavigationMode}
        onClear={navigation.clearNavigation}
      />
    </div>
  {/if}
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
