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
   * - MapSession.svelte.js - Builds the map and everything on it, releases it all on unmount
   * - MapConstants.js - Configuration constants
   * - MapBuilder.svelte.js - MapPointsBuilder configuration
   * - MapNavigation.svelte.js - Point-to-point (A>B) navigation logic
   * - MapNavigationGPS.svelte.js - GPS navigation logic
   * - MapTheme.svelte.js - Theme management
   * - MapLifecycle.svelte.js - Map instance, tiles protocol and their cleanup (used by MapSession)
   */

  import { onMount, onDestroy } from "svelte";
  import { Progressbar, Link } from "konsta/svelte";
  import RoutingNavigationIcon from "@/lib/icons/RoutingNavigationIcon.svelte";

  // Navbar
  import { resolvePageKeyFromRouteResult } from "@/utils/routerUtils";
  import { patchNavbar, withNavbar } from "@/lib/state/navbar.svelte";
  import { openPanel, patchPanel, withPanel } from "@/lib/state/panel.svelte";

  // Components
  import NavigationSheet from "@/components/Navigation/NavigationSheet.svelte";
  import { createToggle } from "@/lib/state/createToggler.svelte";

  // Map modules
  import { createMapSession } from "./MapSession.svelte.js";
  import { resolveTargetCoords } from "./MapLifecycle.svelte.js";
  import { createCustomPointsEditor } from "./MapCustomPointsEditor.svelte.js";
  import { routeMapClick } from "./MapClickRouter.js";

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
  // Custom-point editing: the edit mode's state, save and delete (created once the map has started)
  let pointsEditor = $state(null);

  // Progressbar state
  let mapLoadingProgress = $state(0);
  let mapReady = $state(false);

  // Target coordinates from URL params (?lon=X&lat=Y)
  const targetCoords = $derived(resolveTargetCoords(route));

  // The map and everything built on it: tiles, builders, navigation, theme (MapSession.svelte.js)
  const session = createMapSession({
    i18n: $i18n,
    isPopupEnabled,
    getTargetCoords: () => targetCoords,
    onMapClick: handleUnifiedMapClick,
    onProgress: (value) => (mapLoadingProgress = value),
    onReady: () => (mapReady = true),
  });
  const navigation = $derived(session.navigation); // Point-to-point navigation
  const gpsNavigation = $derived(session.gpsNavigation); // GPS navigation

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

  // sheet toggler
  const sheetToggler = createToggle();
  const userCustomPointsToggler = createToggle();
  const userCustomDialogState = customPointsDialogState();

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

    if (session.builder) session.builder.setMarkersVisible(filter !== MARKER_FILTER.CUSTOM);

    if (session.customPointsBuilder) session.customPointsBuilder.setVisible(filter !== MARKER_FILTER.HISTORICAL);
  }

  $effect(() => {
    syncMarkerFilter();
  });

  // One map click handler for every mode; MapClickRouter decides which one takes the tap
  function handleUnifiedMapClick(e) {
    const takenBy = routeMapClick(e, {
      gpsNavigation,
      navigation,
      pointsEditor,
      isEditing: userCustomPointsToggler.value,
    });

    IS_DEBUG && mapLogger.log("Map click taken by:", takenBy ?? "no mode");
  }

  // ========================================
  // LIFECYCLE - MOUNT
  // ========================================

  onMount(() => {
    session.start(mapContainer).then((isStarted) => {
      if (!isStarted) return;

      // The filter could be restored from the storage before the builders were created
      syncMarkerFilter();
      pointsEditor = createCustomPointsEditor({ session, i18n: $i18n });
    });

    return () => session.dispose();
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
  // Effects
  // ========================================

  $effect(() => {
    const result = route?.result;
    const pageKey = resolvePageKeyFromRouteResult(result);

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

  {#if pointsEditor}
    <CustomPointsMapEditorDialog
      {i18n}
      coords={pointsEditor.editMode.coordinates}
      opened={pointsEditor.editMode.modalDialogState}
      editingPoint={pointsEditor.editingPoint}
      onCloseModal={pointsEditor.editMode.closeModal}
      onSave={pointsEditor.save}
      onDelete={pointsEditor.remove}
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
  /* MapLibre's own elements (popups, markers, attribution) are styled in assets/styles/maplibre.css */
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
</style>
