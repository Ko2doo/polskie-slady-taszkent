<script>
  import { Sheet, Toolbar, ToolbarPane, Block, Link, Button, Progressbar } from "konsta/svelte";

  // Icons
  import Close from "@/lib/icons/Close.svelte";
  import ModeSelection from "./ModeSelection.svelte";
  import NavigationInstruction from "./NavigationInstruction.svelte";
  import RouteInfo from "./RouteInfo.svelte";
  import NavigationArrivalMsg from "./NavigationArrivalMsg.svelte";

  let {
    i18n, // Point-to-Point mode
    sheetToggler,
    navigationMode = $bindable(false),
    navigationReady = false,
    navigationLoading = false,
    routeInfo = null,
    onToggle = () => {},
    onClear = () => {},
    // GPS mode
    gpsMode = $bindable(false),
    gpsReady = false,
    gpsLoading = false,
    gpsRouteInfo = null,
    onGPSToggle = () => {},
    onGPSClear = () => {},
    isArrived = false,
  } = $props();

  // Determine which mode is active
  const isAnyModeActive = $derived(navigationMode || gpsMode);
  const activeMode = $derived(navigationMode ? "manual" : gpsMode ? "gps" : null);
  const activeRouteInfo = $derived(navigationMode ? routeInfo : gpsRouteInfo);
</script>

<Sheet class="pb-safe" opened={sheetToggler.value} backdrop={false}>
  <Toolbar top innerClass="w-full items-center" class="ios:pt-4">
    <div class="flex flex-col">
      <!-- Route info title -->
      {#if activeRouteInfo && !activeRouteInfo.loading}
        <span class="text-md font-bold text-white dark:text-dark">
          {activeMode === "gps" ? $i18n.t("ui:map:gps:routing") : $i18n.t("ui:map:infoPanel:info")}
        </span>
        <!-- Route instruction title -->
      {:else if isAnyModeActive && !isArrived}
        <span class="text-md font-bold text-white dark:text-dark">
          {activeMode === "gps" ? $i18n.t("ui:map:gps:instruction") : $i18n.t("ui:map:infoPanel:setRoutePoints")}
        </span>

        <!-- modal sheet title & subtitle (default state) -->
      {:else}
        <span class="text-md font-bold text-white dark:text-dark">
          {$i18n.t("ui:modalSheet:nav:title")}
        </span>
        <span class="text-xs font-normal text-gray-200 dark:text-gray-400">
          {$i18n.t("ui:modalSheet:nav:subtitle")}
        </span>
      {/if}
    </div>

    <div class="flex flex-row gap-2">
      <!-- Cancel navigation mode button -->
      {#if isAnyModeActive}
        <ToolbarPane>
          <Button
            clear
            inline
            colors={{ textIos: "text-red-500" }}
            onClick={activeMode === "manual" ? onToggle : onGPSToggle}
          >
            {$i18n.t("ui:map:nav:cancel")}
          </Button>
        </ToolbarPane>
      {/if}

      <!-- Close modal sheet button -->
      <ToolbarPane>
        <Link iconOnly class="p-2" onClick={sheetToggler.close}><Close className="size-5" /></Link>
      </ToolbarPane>
    </div>
  </Toolbar>

  <Block nested class="mt-2 mb-4">
    <!-- Mode Selection Buttons -->
    {#if !isAnyModeActive}
      <ModeSelection {i18n} {isAnyModeActive} {onToggle} {navigationLoading} {onGPSToggle} {gpsLoading} />
    {/if}

    <!-- Info Panel -->
    {#if isAnyModeActive && (navigationReady || gpsReady)}
      <section class="nav-info-panel">
        {#if isArrived}
          <!-- Arrival Message -->
          <NavigationArrivalMsg {i18n} {activeMode} {onClear} {onGPSClear} />
        {:else if activeRouteInfo?.loading}
          <!-- Progressbar -->
          <div class="space-y-2">
            <p class="text-sm font-bold text-gray-900 dark:text-white">
              {$i18n.t("ui:map:infoPanel:calc")}
            </p>
            <Progressbar progress={activeRouteInfo} />
          </div>
        {:else if activeRouteInfo && !activeRouteInfo.loading}
          <!-- Route Info -->
          <RouteInfo {i18n} {activeMode} {activeRouteInfo} {onClear} {onGPSClear} />
        {:else}
          <!-- Instructions -->
          <NavigationInstruction {i18n} {activeMode} />
        {/if}
      </section>
    {/if}
  </Block>
</Sheet>
