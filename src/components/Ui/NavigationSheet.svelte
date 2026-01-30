<script>
  import { Sheet, Toolbar, ToolbarPane, Block, Link } from "konsta/svelte";

  // Icons
  import Close from "@/lib/icons/Close.svelte";

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
  <Toolbar top class="justify-end ios:pt-4">
    <div class="ios:hidden"></div>

    <ToolbarPane>
      <Link iconOnly onClick={sheetToggler.close}><Close /></Link>
    </ToolbarPane>
  </Toolbar>

  <Block nested class="mt-4 mb-4">
    <!-- Mode Selection Buttons -->
    {#if !isAnyModeActive}
      <div class="flex flex-col gap-2">
        <!-- Point-to-Point Navigation -->
        <button
          onclick={onToggle}
          disabled={navigationLoading}
          class="nav-btn bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-800 dark:text-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fill-rule="evenodd"
              d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
              clip-rule="evenodd"
            />
          </svg>
          <span>{$i18n.t("ui:map:nav:pointToPoint")}</span>
        </button>

        <!-- GPS Navigation -->
        <button onclick={onGPSToggle} disabled={gpsLoading} class="nav-btn bg-blue-500 hover:bg-blue-600 text-white">
          {#if gpsLoading}
            <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fill-rule="evenodd"
                d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                clip-rule="evenodd"
              />
              <path
                d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zM10 16a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1z"
              />
            </svg>
          {/if}
          <span>
            {gpsLoading ? $i18n.t("ui:map:nav:loading") : $i18n.t("ui:map:gps:navigate")}
          </span>
        </button>
      </div>
    {:else}
      <!-- Active Mode - Exit Button -->
      <button
        onclick={activeMode === "manual" ? onToggle : onGPSToggle}
        class="nav-btn bg-red-500 hover:bg-red-600 text-white"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path
            fill-rule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clip-rule="evenodd"
          />
        </svg>
        <span>{$i18n.t("ui:map:nav:exit")}</span>
      </button>
    {/if}

    <!-- Info Panel -->
    {#if isAnyModeActive && (navigationReady || gpsReady)}
      <section class="nav-info-panel bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        {#if isArrived}
          <!-- Arrival Message -->
          <div class="space-y-3">
            <div class="flex items-center gap-2 text-green-600 dark:text-green-400">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clip-rule="evenodd"
                />
              </svg>
              <p class="text-sm font-bold">
                {$i18n.t("ui:map:gps:arrived")}
              </p>
            </div>

            <button
              onclick={activeMode === "manual" ? onClear : onGPSClear}
              class="w-full px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg"
            >
              {$i18n.t("ui:map:gps:newRoute")}
            </button>
          </div>
        {:else if activeRouteInfo?.loading}
          <!-- Loading -->
          <div class="space-y-2">
            <p class="text-sm font-bold text-gray-900 dark:text-white">
              {$i18n.t("ui:map:infoPanel:calc")}
            </p>
            <div class="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div class="h-full bg-blue-500 animate-pulse w-full"></div>
            </div>
          </div>
        {:else if activeRouteInfo && !activeRouteInfo.loading}
          <!-- Route Info -->
          <article class="space-y-3">
            <div class="flex items-center justify-between">
              <p class="text-sm font-bold text-gray-900 dark:text-white">
                {activeMode === "gps" ? $i18n.t("ui:map:gps:routing") : $i18n.t("ui:map:infoPanel:info")}
              </p>
              <span class="text-xs text-gray-500 dark:text-gray-400">
                {activeRouteInfo.computeTime}{$i18n.t("ui:map:infoPanel:time")}
              </span>
            </div>

            <div class="space-y-2">
              <div class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span class="text-lg">📏</span>
                <span>
                  <strong>{(activeRouteInfo.distance / 1000).toFixed(2)}</strong>
                  {$i18n.t("ui:map:infoPanel:distance")}
                </span>
              </div>

              <div class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span class="text-lg">⏱️</span>
                <span>
                  ~<strong>{Math.round((activeRouteInfo.distance / 1000 / 5) * 60)}</strong>
                  {$i18n.t("ui:map:infoPanel:walk")}
                </span>
              </div>
            </div>

            <button
              onclick={activeMode === "manual" ? onClear : onGPSClear}
              class="w-full mt-3 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg"
            >
              {$i18n.t("ui:map:infoPanel:clear")}
            </button>
          </article>
        {:else}
          <!-- Instructions -->
          <article class="space-y-3">
            <p class="text-sm font-bold text-gray-900 dark:text-white">
              {activeMode === "gps" ? $i18n.t("ui:map:gps:instruction") : $i18n.t("ui:map:infoPanel:setRoutePoints")}
            </p>

            {#if activeMode === "manual"}
              <div class="space-y-2">
                <div class="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <span class="text-lg flex-shrink-0">🟢</span>
                  <span>{$i18n.t("ui:map:infoPanel:startProg")}</span>
                </div>

                <div class="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <span class="text-lg flex-shrink-0">🔴</span>
                  <span>{$i18n.t("ui:map:infoPanel:endProg")}</span>
                </div>
              </div>
            {/if}
          </article>
        {/if}
      </section>
    {/if}
  </Block>
</Sheet>
