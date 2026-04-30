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
   * Supports two navigation modes:
   * 1. Point-to-point (A>B) - Manual selection (existing functionality)
   * 2. GPS Navigation - From current location (new feature)
   * - Deep linking support (?lon=X&lat=Y)
   *
   * Architecture:
   * - MapConstants.js - Configuration constants
   * - MapBuilder.svelte.js - MapPointsBuilder configuration
   * - MapNavigation.svelte.js - Point-to-point (A>B) navigation logic
   * - MapNavigationGPS.svelte.js - GPS navigation logic
   * - MapTheme.svelte.js - Theme management
   * - MapLifecycle.svelte.js - Initialization and cleanup
   */

  import { onMount, onDestroy } from "svelte";
  import { Progressbar, Dialog, DialogButton, Link } from "konsta/svelte";
  import RoutingNavigationIcon from "@/lib/icons/RoutingNavigationIcon.svelte";
  // import { goto } from "@mateothegreat/svelte5-router";

  // Navbar
  import { resolvePageKeyFromRouteResult } from "@/utils/routerUtils";
  import { patchNavbar, withNavbar } from "@/store/ui/navbar";

  // Data
  import { articlesMeta } from "@/data/articles";

  // Error handling
  import { errorToast } from "@/store/ui/errorToast";
  import { ERROR_CODES } from "@/lib/errors/errorCodes";

  // Components
  // import NavigationControl from "@/components/Ui/NavigationControl.svelte";
  import NavigationSheet from "@/components/Navigation/NavigationSheet.svelte";
  import { createToggle } from "@/lib/state/createToggler.svelte";
  import { articlePopupState } from "@/lib/state/article.svelte.js";

  // Map modules
  import { createMapPointsBuilder } from "./MapBuilder.svelte.js";
  import { createNavigationController } from "./MapNavigation.svelte.js";
  import { createGPSNavigationController } from "./MapNavigationGPS.svelte.js";
  import { createThemeController } from "./MapTheme.svelte.js";
  import {
    initializePMTiles,
    initializeMap,
    setupMapHandlers,
    cleanupMap,
    resolveTargetCoords,
  } from "./MapLifecycle.svelte.js";
  import { createMapLoadTracker } from "./MapLoadTracker.js";

  import { createLogger, IS_DEBUG } from "@/utils/debugMode.js";

  // Logger
  const mapLogger = createLogger("Map");

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
  let navigation = $state(null); // Point-to-point navigation
  let gpsNavigation = $state(null); // GPS navigation
  let theme = null;

  // Progressbar state
  let mapLoadingProgress = $state(0);
  let mapReady = $state(false);

  // Target coordinates from URL params (?lon=X&lat=Y)
  let targetCoords = $state(null);

  // ========================================
  // DERIVED STATE
  // ========================================

  // prettier-ignore
  const activeNav = $derived(
    navigation?.navigationMode
      ? navigation
      : gpsNavigation?.gpsMode
        ? gpsNavigation
        : null
  );

  // Resolve target coordinates from route
  $effect(() => {
    targetCoords = resolveTargetCoords(route);
  });

  // sheet toggler
  const sheetToggler = createToggle();

  /**
   * Unified map click handler
   * Routes clicks to appropriate navigation controller
   * Only ONE mode can be active at a time
   */
  function handleUnifiedMapClick(e) {
    IS_DEBUG && mapLogger.log("Unified click handler triggered");

    IS_DEBUG &&
      mapLogger.log("GPS state:", {
        exists: !!gpsNavigation,
        mode: gpsNavigation?.gpsMode,
        ready: gpsNavigation?.gpsReady,
      });

    IS_DEBUG &&
      mapLogger.log("Navigation state:", {
        exists: !!navigation,
        mode: navigation?.navigationMode,
        ready: navigation?.navigationReady,
      });

    // Check GPS mode first (priority)
    // GPS requires ready state because it needs permissions and tracker
    if (gpsNavigation && gpsNavigation.gpsMode && gpsNavigation.gpsReady) {
      gpsNavigation.handleMapClick(e);
      return;
    }

    // Check Point-to-Point mode
    // Point-to-Point doesn't need ready check - it initializes on first click
    if (navigation && navigation.navigationMode) {
      navigation.handleMapClick(e);
      return;
    }

    IS_DEBUG && mapLogger.log("No mode active, click ignored");

    // No mode active - do nothing
  }

  // ========================================
  // LIFECYCLE - MOUNT
  // ========================================

  onMount(async () => {
    IS_DEBUG && mapLogger.log("Mounting...");

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

      // mapLibre loading tracker
      const tracker = createMapLoadTracker({
        map,
        setProgress: (v) => (mapLoadingProgress = v),
        setReady: () => (mapReady = true),
        startOffset: 40,
      });

      // 5. Create MapPointsBuilder
      builder = createMapPointsBuilder({
        map,
        data: articlesMeta,
        i18n: $i18n,
        popupTrigger: (id) => articlePopupState.open(id),
        styleVersion: theme.styleVersion,
      });

      // 6. Create Point-to-Point navigation controller
      navigation = createNavigationController({
        map,
        builder,
        i18n: $i18n,
      });

      // 7. Create GPS navigation controller
      gpsNavigation = createGPSNavigationController({
        map,
        builder,
        i18n: $i18n,
      });

      // 8. Update theme controller with instances
      theme = createThemeController({
        map,
        builder,
        navigation,
        i18n: $i18n,
      });
      theme.init();

      // 9. Setup map handlers when map loads
      map.on("load", () => {
        setupMapHandlers({
          map,
          builder,
          navigation,
          targetCoords,
        });

        // Attach unified click handler
        map.on("click", handleUnifiedMapClick);
        tracker.markSourcesAdded();
      });

      IS_DEBUG && mapLogger.log("Initialization complete");
    } catch (error) {
      IS_DEBUG && mapLogger.error("Initialization failed:", error);

      errorToast.error($i18n.t("errors:mapInitFailed"), {
        scope: "Map",
        code: ERROR_CODES.MAP_INIT_FAILED,
      });
    }
  });

  // Navbar
  onMount(() => {
    const disposeNavbar = withNavbar({
      title: "",
      leftSnippet: null, // right slot: (unused for now)
      rightSnippet: NavigationSheetBtn, // left slot: open navigation modal button
      subnavSnippet: null, // subnavbar: null
    });

    onDestroy(() => {
      disposeNavbar();
    });
  });

  // ========================================
  // LIFECYCLE - UNMOUNT
  // ========================================

  onDestroy(() => {
    IS_DEBUG && mapLogger.log("Unmounting...");

    // Remove unified click handler
    if (map) {
      map.off("click", handleUnifiedMapClick);
    }

    cleanupMap({
      map,
      protocol,
      builder,
      navigation,
      theme,
    });

    // Cleanup GPS navigation
    if (gpsNavigation) {
      gpsNavigation.dispose();
    }

    // Nullify references
    map = null;
    protocol = null;
    builder = null;
    navigation = null;
    gpsNavigation = null;
    theme = null;
  });

  // ========================================
  // NAVBAR CONFIGURATION
  // ========================================

  $effect(() => {
    const result = route?.result;
    const pageKey = resolvePageKeyFromRouteResult(result);
    const title = pageKey ? $i18n.t(`ui:navbar:${pageKey}:title`) : "";

    patchNavbar({ title: title || pageKey });
  });
</script>

<!-- Navigation modal sheet button trigger -->
{#snippet NavigationSheetBtn()}
  <Link iconOnly onClick={sheetToggler.open}>
    <RoutingNavigationIcon />
  </Link>
{/snippet}

<section class="map-section">
  {#if !mapReady}
    <div class="absolute inset-0 flex items-center justify-center">
      <div class="w-64 text-center space-y-2">
        <h1 class="text-sm font-medium">
          {Math.round(mapLoadingProgress * 100)}%
        </h1>

        <Progressbar progress={mapLoadingProgress} />
      </div>
    </div>
  {/if}

  <!-- Map container -->
  <div
    bind:this={mapContainer}
    class={`map-container transition-opacity duration-300 ${mapReady ? "opacity-100" : "opacity-0"}`}
  ></div>

  <!-- Navigation Sheet -->
  <!-- prettier-ignore -->
  {#if navigation && gpsNavigation}
    <NavigationSheet
      {i18n}
      {sheetToggler}
      bind:navigationMode={navigation.navigationMode}
      navigationReady={navigation.navigationReady}
      navigationLoading={navigation.navigationLoading}
      routeInfo={navigation.routeInfo}
      onToggle={navigation.toggleNavigationMode}
      onClear={navigation.clearNavigation}

      bind:gpsMode={gpsNavigation.gpsMode}
      gpsReady={gpsNavigation.gpsReady}
      gpsLoading={gpsNavigation.gpsLoading}
      gpsRouteInfo={gpsNavigation.routeInfo}
      isArrived={gpsNavigation.isArrived}
      onGPSToggle={gpsNavigation.toggleGPSMode}
      onGPSClear={gpsNavigation.clearGPSNavigation}
    />
  {/if}

  <!-- Navigation control Dialog -->
  {#if activeNav}
    <Dialog opened={activeNav.dialogState}>
      {#snippet title()}
        {$i18n.t("ui:dialog:map:newRoute:title")}
      {/snippet}

      {#snippet buttons()}
        <DialogButton strong onClick={activeNav.closeDialog}>
          {$i18n.t("ui:dialog:map:newRoute:no")}
        </DialogButton>

        <DialogButton onClick={activeNav.confirmNewDestination}>
          {$i18n.t("ui:dialog:map:newRoute:yes")}
        </DialogButton>
      {/snippet}
    </Dialog>
  {/if}
</section>

<style>
  /* Custom position on map libre attribution */
  :global(.maplibregl-ctrl-top-left) {
    top: 62px;
    z-index: 10;
  }

  :global(.maplibregl-popup-content) {
    padding: 0;
    background: var(--color-ios-light-surface);
    border-radius: var(--radius-3xl);
  }

  :global(.map-content-wrapper) {
    padding: 12px 12px 22px 12px;
  }

  :global(.maplibregl-popup-anchor-top .maplibregl-popup-tip) {
    border-bottom-color: var(--color-ios-light-surface);
  }

  :global(.maplibregl-popup-anchor-bottom .maplibregl-popup-tip) {
    border-top-color: var(--color-ios-light-surface);
  }

  :global(.maplibregl-popup-anchor-top-left .maplibregl-popup-tip) {
    border-bottom-color: var(--color-ios-light-surface);
  }

  :global(.maplibregl-popup-anchor-top-right .maplibregl-popup-tip) {
    border-bottom-color: var(--color-ios-light-surface);
  }

  :global(.maplibregl-popup-anchor-right .maplibregl-popup-tip) {
    border-left-color: var(--color-ios-light-surface);
  }

  :global(.maplibregl-popup-anchor-left .maplibregl-popup-tip) {
    border-right-color: var(--color-ios-light-surface);
  }

  :global(.maplibregl-popup-anchor-bottom-left .maplibregl-popup-tip) {
    border-top-color: var(--color-ios-light-surface);
  }

  :global(.maplibregl-popup-anchor-bottom-right .maplibregl-popup-tip) {
    border-top-color: var(--color-ios-light-surface);
  }

  /* Dark */
  :global(.dark .maplibregl-popup-content) {
    background: var(--color-ios-dark-surface-1-tint);
  }

  :global(.dark .maplibregl-popup-anchor-top .maplibregl-popup-tip) {
    border-bottom-color: var(--color-ios-dark-surface-1-tint);
  }

  :global(.dark .maplibregl-popup-anchor-bottom .maplibregl-popup-tip) {
    border-top-color: var(--color-ios-dark-surface-1-tint);
  }

  :global(.dark .maplibregl-popup-anchor-top-left .maplibregl-popup-tip) {
    border-bottom-color: var(--color-ios-dark-surface-1-tint);
  }

  :global(.dark .maplibregl-popup-anchor-top-right .maplibregl-popup-tip) {
    border-bottom-color: var(--color-ios-dark-surface-1-tint);
  }

  :global(.dark .maplibregl-popup-anchor-right .maplibregl-popup-tip) {
    border-left-color: var(--color-ios-dark-surface-1-tint);
  }

  :global(.dark .maplibregl-popup-anchor-left .maplibregl-popup-tip) {
    border-right-color: var(--color-ios-dark-surface-1-tint);
  }

  :global(.dark .maplibregl-popup-anchor-bottom-left .maplibregl-popup-tip) {
    border-top-color: var(--color-ios-dark-surface-1-tint);
  }

  :global(.dark .maplibregl-popup-anchor-bottom-right .maplibregl-popup-tip) {
    border-top-color: var(--color-ios-dark-surface-1-tint);
  }

  .map-section {
    width: 100%;
    height: 100%;

    display: grid;
    grid-template-columns: 1fr;

    padding-left: 1rem;
    padding-right: 1rem;
    padding-bottom: 1rem;
  }

  .map-container {
    position: absolute;
    top: 0;
    bottom: 0;
    right: 0;
    left: 0;

    width: 100%;
    height: 100%;
  }

  :global(.navigation-marker) {
    cursor: pointer;
    user-select: none;
  }

  /* User Location Marker Styles */
  :global(.user-location-marker) {
    width: 40px;
    height: 40px;
    position: relative;
  }

  :global(.user-dot) {
    width: 16px;
    height: 16px;
    background: #4285f4;
    border: 3px solid white;
    border-radius: 50%;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  }

  :global(.pulse-ring) {
    width: 40px;
    height: 40px;
    border: 2px solid #4285f4;
    border-radius: 50%;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    animation: pulse 2s ease-out infinite;
    opacity: 0.6;
  }

  @keyframes pulse {
    0% {
      transform: translate(-50%, -50%) scale(0.5);
      opacity: 1;
    }
    100% {
      transform: translate(-50%, -50%) scale(1.2);
      opacity: 0;
    }
  }
</style>
