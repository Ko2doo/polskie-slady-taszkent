<script>
  import { Sheet, Toolbar, ToolbarPane, Block, Link, Button, Dialog, DialogButton, Progressbar } from "konsta/svelte";
  import { createToggle } from "@/lib/state/createToggler.svelte";

  // Icons
  import Close from "@/lib/icons/Close.svelte";
  import ModeSelection from "./NavigationModeSelection.svelte";
  import NavigationInstruction from "./NavigationInstruction.svelte";
  import RouteInfo from "./NavigationRouteInfo.svelte";
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

  // prettier-ignore
  const navigationLoadingState = $derived(
    navigationLoading
      ? navigationLoading
      : gpsLoading
        ? gpsLoading
        : null
  );

  const dialogToggler = createToggle();
</script>

<Sheet class="pb-safe" opened={sheetToggler.value} backdrop={false}>
  <Toolbar top innerClass="w-full items-center" class="ios:pt-4">
    <div class="flex flex-col">
      <!-- Route info title -->
      {#if activeRouteInfo && !activeRouteInfo.loading}
        <span class="text-xl font-bold text-stone-600 dark:text-stone-300">
          {activeMode === "gps" ? $i18n.t("ui:map:gps:routing") : $i18n.t("ui:map:infoPanel:info")}
        </span>
        <!-- Route instruction title -->
      {:else if isAnyModeActive && !isArrived}
        <span class="text-xl font-bold text-stone-600 dark:text-stone-300">
          {activeMode === "gps" ? $i18n.t("ui:map:gps:instruction") : $i18n.t("ui:map:infoPanel:setRoutePoints")}
        </span>

        <!-- modal sheet title (default state) -->
      {:else}
        <span class="text-xl font-bold text-stone-600 dark:text-stone-300">
          {$i18n.t("ui:modalSheet:nav:title")}
        </span>
      {/if}
    </div>

    <!-- Universal close button -->
    <div class="flex flex-row gap-2">
      <ToolbarPane>
        <!-- End navigation -->
        {#if activeRouteInfo && !activeRouteInfo.loading}
          <Link iconOnly class="p-2" onClick={dialogToggler.open}>
            <Close className="size-5" />
          </Link>

          <!-- Cancel -->
        {:else if isAnyModeActive && !isArrived}
          <Link
            iconOnly
            class="p-2"
            onClick={activeMode === "manual" ? onToggle : onGPSToggle}
            disabled={navigationLoadingState}
          >
            <Close className="size-5" />
          </Link>

          <!-- Default close button (close sheet window) -->
        {:else}
          <Link iconOnly class="p-2" onClick={sheetToggler.close}>
            <Close className="size-5" />
          </Link>
        {/if}
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
          <NavigationArrivalMsg {i18n} />
        {:else if activeRouteInfo?.loading}
          <!-- Progressbar -->
          <div class="space-y-2">
            <p class="text-md font-bold text-gray-900 dark:text-white">
              {$i18n.t("ui:map:infoPanel:calc")}
            </p>
            <Progressbar progress={activeRouteInfo} />
          </div>
        {:else if activeRouteInfo && !activeRouteInfo.loading}
          <!-- Route Info -->
          <RouteInfo {i18n} {activeRouteInfo} />
        {:else}
          <!-- Instructions -->
          <NavigationInstruction {i18n} {activeMode} />
        {/if}
      </section>
    {/if}
  </Block>
</Sheet>

<!-- Dialog component -->
<Dialog opened={dialogToggler.value}>
  {#snippet title()}
    {$i18n.t("ui:dialog:nav:title")}
  {/snippet}

  {#snippet buttons()}
    <DialogButton strong onClick={dialogToggler.close}>
      {$i18n.t("ui:dialog:nav:no")}
    </DialogButton>

    <DialogButton
      onClick={() => {
        dialogToggler.set(false);
        activeMode === "manual" ? onClear() : onGPSClear();
        activeMode === "manual" ? onToggle() : onGPSToggle();
      }}
    >
      {$i18n.t("ui:dialog:nav:yes")}
    </DialogButton>
  {/snippet}
</Dialog>
