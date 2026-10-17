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

  import { onMount, onDestroy, setContext } from "svelte";
  import { Progressbar, Link } from "konsta/svelte";
  import RoutingNavigationIcon from "@/lib/icons/RoutingNavigationIcon.svelte";
  // import { goto } from "@mateothegreat/svelte5-router";

  // Navbar
  import { resolvePageKeyFromRouteResult } from "@/utils/routerUtils";
  import { patchNavbar, withNavbar } from "@/lib/state/navbar.svelte";
  import { openPanel, patchPanel, withPanel } from "@/lib/state/panel.svelte";

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
  import { createMapPointsBuilder, createCustomPointsBuilder } from "./MapBuilder.svelte.js";
  import { createPreviewTracker } from "./MapPreview.js";
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
  import { createEditModeController } from "./MapEditMode.svelte.js";
  import { EDIT_MODE_CONFIG } from "./MapConstants.js";
  import { createMapLoadTracker } from "./MapLoadTracker.js";

  import { createLogger, IS_DEBUG } from "@/utils/debugMode.js";
  import MapEditor from "@/lib/icons/MapEditor.svelte";
  import FilterIcon from "@/lib/icons/FilterIcon.svelte";
  import Close from "@/lib/icons/Close.svelte";
  import { hideTabbar } from "@/lib/state/bottomTabbarNav.svelte.js";
  import CustomPointsDialog from "@/components/CustomPoints/CustomPointsDialog.svelte";
  import NavigationControlDialog from "@/components/Navigation/NavigationControlDialog.svelte";
  import { customPointsDialogState } from "@/lib/state/customPointsDialogState.svelte.js";
  import { customPointsState } from "@/lib/state/customPointsState.svelte.js";
  import { MARKER_FILTER, mapMarkerFilter } from "@/lib/state/mapMarkerFilter.svelte.js";
  import MapMarkersFilter from "@/components/Filters/MapMarkersFilter.svelte";
  import CustomPointsMapEditorDialog from "@/components/CustomPoints/CustomPointsMapEditorDialog.svelte";

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
  let customPointsBuilder = null; // User-created points
  let navigation = $state(null); // Point-to-point navigation
  let gpsNavigation = $state(null); // GPS navigation
  let mapEditMode = $state(null);
  let theme = null;
  // Set by onDestroy; the async onMount checks it before creating the map and before building on it
  let isDestroyed = false;
  // The photo urls the custom points' popups hold (released on change, delete and unmount)
  const previewTracker = createPreviewTracker();

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
  const userCustomPointsToggler = createToggle();
  const userCustomDialogState = customPointsDialogState();

  // Custom point opened in the map editor dialog for updating (null while a new point is being created)
  const editingPoint = $derived(
    mapEditMode && mapEditMode.editingPointId ? customPointsState.getById(mapEditMode.editingPointId) : null,
  );

  /**
   * Marker popups (article markers and custom points) are disabled while the map editor mode
   * or a navigation mode is active: a click on a marker must only be handled by that mode
   */
  function isPopupEnabled() {
    return !userCustomPointsToggler.value && !activeNav;
  }

  // The markers filter is available only while custom points exist
  const hasCustomPoints = $derived(customPointsState.points.length > 0);

  // Markers filter applied to the map:
  //  - the map editor mode always shows custom points only (the filter saved by the user stays untouched)
  //  - without custom points there is nothing to filter
  const markerFilter = $derived.by(() => {
    if (userCustomPointsToggler.value) return MARKER_FILTER.CUSTOM;

    if (!hasCustomPoints) return MARKER_FILTER.ALL;

    return mapMarkerFilter.selected;
  });

  /**
   * Push the applied markers filter to the builders.
   * The builders keep the value for the layers that are (re)added later, e.g. after a theme change.
   */
  function syncMarkerFilter() {
    // Read it first and unconditionally: while the builders do not exist yet the effect below would otherwise
    // track nothing and would never run again
    const filter = markerFilter;

    if (builder) builder.setMarkersVisible(filter !== MARKER_FILTER.CUSTOM);

    if (customPointsBuilder) customPointsBuilder.setVisible(filter !== MARKER_FILTER.HISTORICAL);
  }

  $effect(() => {
    syncMarkerFilter();
  });

  /**
   * Map editor mode click handler
   * A click on an existing custom point opens it for updating, a click on an empty place starts a new point,
   * a click on (or next to) an article marker is refused with a warning
   * @param {Object} e - MapLibre click event
   */
  function handleEditModeClick(e) {
    const pointId = customPointsBuilder ? customPointsBuilder.getPointIdAt(e.point) : null;
    const point = pointId ? customPointsState.getById(pointId) : null;

    if (point) {
      mapEditMode.startEditing(point);
      return;
    }

    // Article markers are hidden in the editor mode, so their places must be protected from accidental new points
    if (builder && builder.isMarkerNear(e.point, EDIT_MODE_CONFIG.historicalMarkerGuardRadius)) {
      IS_DEBUG && mapLogger.log("Click ignored: too close to a historical marker");

      errorToast.warn($i18n.t("errors:customPointNearHistorical"));
      return;
    }

    mapEditMode.handleMapClick(e);
  }

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

    IS_DEBUG &&
      mapLogger.log("Edit mode state:", {
        exists: !!mapEditMode,
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

    if (userCustomPointsToggler.value) {
      handleEditModeClick(e);
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
      // Left during the tiles/style load: don't create a map (a WebGL context) on a detached container
      if (isDestroyed) return releaseMapResources();

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
        isPopupEnabled,
        styleVersion: theme.styleVersion,
      });

      // 5.1 Create CustomPointsBuilder (user-created points)
      customPointsBuilder = createCustomPointsBuilder({
        map,
        i18n: $i18n,
        popupTrigger: (id) => articlePopupState.open(id),
        isPopupEnabled,
        styleVersion: theme.styleVersion,
      });

      // The state outlives this component, so restore already created points (wait until they are loaded from the file)
      await customPointsState.ready;

      // The previews (the first photo of a point) are resolved all at once, then the points are added
      const savedPoints = [...customPointsState.points];
      const previews = await Promise.all(savedPoints.map((point) => previewTracker.resolve(point)));
      // Left while the points loaded: onDestroy released the map, don't build on top of it
      if (isDestroyed) return releaseMapResources();

      savedPoints.forEach((point, index) => {
        customPointsBuilder.addPoint({
          id: point.id,
          coords: point.coords,
          title: point.title,
          preview: previews[index],
        });
      });

      // The filter could be restored from the storage before the builders were created
      syncMarkerFilter();

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

      // 8. Update theme controller with instances (the map-less one from step 2 must let go of
      // its themeManager subscription first, or it stays subscribed for the app's lifetime)
      theme.dispose();
      theme = createThemeController({
        map,
        builder,
        customPointsBuilder,
        navigation,
        // GPS navigation draws its route through the same builder, so it must survive a theme switch too
        getCurrentRoute: () => navigation?.currentRoute ?? gpsNavigation?.currentRoute,
        i18n: $i18n,
      });
      theme.init();

      // 9. Create map editor controller
      mapEditMode = createEditModeController();

      // 10. Setup map handlers when map loads
      map.on("load", () => {
        setupMapHandlers({
          map,
          builder,
          customPointsBuilder,
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

  // Navbar and Panel
  onMount(() => {
    const disposeNavbar = withNavbar({
      title: "",
      leftSnippet: MarkersFilterBtn, // left slot: open markers filter panel button
      rightSnippet: NavigationSheetBtn, // right slot: open navigation modal button
      subnavSnippet: null, // subnavbar: null
    });

    const disposePanel = withPanel({
      title: "",
      contentSnippet: PanelContent, // panel body content (markers filter)
      side: "left", // open from the left
    });

    onDestroy(() => {
      disposeNavbar();
      disposePanel();
    });
  });

  onMount(() => {
    userCustomDialogState.hasSeen();
  });

  // ========================================
  // LIFECYCLE - UNMOUNT
  // ========================================

  onDestroy(() => {
    IS_DEBUG && mapLogger.log("Unmounting...");

    isDestroyed = true;
    releaseMapResources();
  });

  /**
   * Release everything the map screen has created so far. Runs on unmount, and again from onMount
   * when the screen was left while it was still loading: onDestroy then ran before the map, the
   * builders or the controllers existed, so whatever onMount created after its await is released
   * here instead of being left alive on a detached container (a WebGL context each time).
   */
  function releaseMapResources() {
    previewTracker.releaseAll();

    // Remove unified click handler
    if (map) {
      map.off("click", handleUnifiedMapClick);
    }

    cleanupMap({
      map,
      protocol,
      builder,
      customPointsBuilder,
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
    customPointsBuilder = null;
    navigation = null;
    gpsNavigation = null;
    theme = null;
    mapEditMode = null;
  }

  // ========================================
  // Effects
  // ========================================

  $effect(() => {
    const result = route?.result;
    const pageKey = resolvePageKeyFromRouteResult(result);
    // const title = pageKey ? $i18n.t(`ui:navbar:${pageKey}:title`) : "";

    const isCustomPointsMode = userCustomPointsToggler.value
      ? $i18n.t(`ui:navbar:${pageKey}:editMode`)
      : $i18n.t(`ui:navbar:${pageKey}:title`);

    patchNavbar({ title: isCustomPointsMode || pageKey });
    patchPanel({ title: $i18n.t("ui:sidePanel:map:title") });
  });

  // The tab bar is hidden while editing the custom points; leaving edit mode (or the screen) releases it
  $effect(() => {
    if (userCustomPointsToggler.value) return hideTabbar({ duration: 120, delay: 40 });
  });

  async function customPointsDialogTrigger() {
    userCustomPointsToggler.open();

    const alreadySeen = await userCustomDialogState.hasSeen();
    if (alreadySeen === false) userCustomDialogState.open();
  }

  async function onDialogConfirm() {
    await userCustomDialogState.markCompleted();
    userCustomDialogState.close();
  }

  /**
   * Save data from the map editor dialog: update the opened point or create a new one
   * @param {Object} formData - { title, description, photos, pointId }
   * @returns {boolean} - true if the point was saved and rendered
   */
  function onCustomPointSave(formData) {
    if (!customPointsBuilder || !mapEditMode) return false;

    if (mapEditMode.editingPointId) {
      return updateCustomPoint(mapEditMode.editingPointId, formData);
    }

    return createCustomPoint(formData);
  }

  /**
   * Show the first photo of a point in its map popup. It does not block the save: a url is resolved in the background.
   * @param {Object} point - Custom point
   */
  async function refreshPreview(point) {
    const preview = await previewTracker.resolve(point);

    // The map can be gone by now
    if (customPointsBuilder) customPointsBuilder.updatePoint({ id: point.id, title: point.title, preview });
  }

  /**
   * Create a new custom point at the clicked coordinates
   * @param {Object} formData - { title, description, photos, pointId }
   * @returns {boolean} - true if the point was saved and rendered
   */
  function createCustomPoint(formData) {
    if (!mapEditMode.coordinates) return false;

    // The map goes first: if it rejects the point, nothing is saved and the photos of the form stay untouched.
    // The id was created when the form opened, the photos of the point already live in the folder of that id
    const renderedPoint = customPointsBuilder.addPoint({
      id: formData.pointId,
      coords: mapEditMode.coordinates,
      title: formData.title,
      preview: "",
    });

    if (!renderedPoint) return false;

    const point = customPointsState.add({
      id: formData.pointId,
      coords: mapEditMode.coordinates,
      title: formData.title,
      description: formData.description,
      photos: formData.photos,
    });

    refreshPreview(point);

    mapEditMode.closeModal();
    return true;
  }

  /**
   * Update title and text of an existing custom point
   * @param {string} id - Custom point id
   * @param {Object} formData - { title, description, photos }
   * @returns {boolean} - true if the point was updated
   */
  function updateCustomPoint(id, formData) {
    // The builder validates the data first, so the state is not changed if the update is rejected
    const renderedPoint = customPointsBuilder.updatePoint({ id, title: formData.title });

    if (!renderedPoint) return false;

    const point = customPointsState.update(id, {
      title: renderedPoint.title,
      description: formData.description,
      photos: formData.photos,
    });

    if (point) refreshPreview(point);

    mapEditMode.closeModal();
    return true;
  }

  /**
   * Delete the custom point opened in the map editor dialog
   * @returns {boolean} - true if the point was deleted
   */
  function onCustomPointDelete() {
    if (!customPointsBuilder || !mapEditMode) return false;

    const id = mapEditMode.editingPointId;

    if (!id) return false;

    // Remove from the map first: if the builder does not know the point, the state stays untouched
    const isRemoved = customPointsBuilder.removePoint(id);

    if (!isRemoved) return false;

    customPointsState.remove(id);
    previewTracker.release(id);

    // Without custom points the filter button disappears, so the filter must not stay on a mode that hides markers
    if (!hasCustomPoints) mapMarkerFilter.select(MARKER_FILTER.ALL);

    mapEditMode.closeModal();
    return true;
  }
</script>

<!-- Markers filter panel button trigger (only when custom points exist, hidden in the map editor mode) -->
{#snippet MarkersFilterBtn()}
  {#if hasCustomPoints && !userCustomPointsToggler.value}
    <Link iconOnly onClick={() => openPanel()}>
      <FilterIcon />
    </Link>
  {/if}
{/snippet}

{#snippet PanelContent()}
  <MapMarkersFilter {i18n} />
{/snippet}

<!-- Navigation modal sheet button trigger and User custom points button trigger -->
{#snippet NavigationSheetBtn()}
  {#if userCustomPointsToggler.value}
    <Link iconOnly onClick={userCustomPointsToggler.close}>
      <Close />
    </Link>
  {:else if !userCustomPointsToggler.value && sheetToggler.value}
    <Link iconOnly onClick={sheetToggler.open}>
      <RoutingNavigationIcon />
    </Link>
  {:else if !userCustomPointsToggler.value}
    <Link iconOnly onClick={customPointsDialogTrigger}>
      <MapEditor />
    </Link>

    <Link iconOnly onClick={sheetToggler.open}>
      <RoutingNavigationIcon />
    </Link>
  {/if}
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

  {#if mapEditMode}
    <CustomPointsMapEditorDialog
      {i18n}
      coords={mapEditMode.coordinates}
      opened={mapEditMode.modalDialogState}
      {editingPoint}
      onCloseModal={mapEditMode.closeModal}
      onSave={onCustomPointSave}
      onDelete={onCustomPointDelete}
    />
  {/if}

  {#if userCustomDialogState.triggerValue}
    <CustomPointsDialog {i18n} openedDialog={userCustomDialogState.triggerValue} onConfirm={onDialogConfirm} />
  {/if}

  <!-- Navigation control Dialog -->
  {#if activeNav}
    <NavigationControlDialog
      {i18n}
      openedDialog={activeNav.dialogState}
      closeDialog={activeNav.closeDialog}
      confirmDialog={activeNav.confirmNewDestination}
    />
  {/if}
</section>

<style>
  /* Custom position on map libre attribution */
  :global(.maplibregl-ctrl-top-left) {
    top: 62px;
    z-index: 10;
  }

  :global(.maplibregl-popup) {
    min-width: 220px;
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
