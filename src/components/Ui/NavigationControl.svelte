<script>
  /**
   * NavigationControl Component
   *
   * Provides UI for navigation mode:
   * - Toggle navigation mode button
   * - Instructions for setting points
   * - Route information display
   * - Clear route button
   */

  let {
    i18n,
    navigationMode = $bindable(false),
    navigationReady = false,
    navigationLoading = false,
    routeInfo = null,
    onToggle = () => {},
    onClear = () => {},
  } = $props();
</script>

<div class="navigation-control">
  <!-- Navigation toggle button -->
  <button
    onclick={onToggle}
    class="nav-toggle-btn shadow-lg font-medium transition-all duration-200
           {navigationMode
      ? 'bg-blue-500 hover:bg-blue-600 text-white'
      : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-800 dark:text-white'}"
    disabled={navigationLoading}
  >
    {#if navigationLoading}
      <span class="flex items-center gap-2">
        <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        Loading...
      </span>
    {:else if navigationMode}
      <span class="flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path
            fill-rule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clip-rule="evenodd"
          />
        </svg>
        Exit Navigation
      </span>
    {:else}
      <span class="flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path
            fill-rule="evenodd"
            d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
            clip-rule="evenodd"
          />
        </svg>
        Navigate
      </span>
    {/if}
  </button>

  <!-- Navigation instructions / info panel -->
  {#if navigationMode && navigationReady}
    <div class="nav-info-panel bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      {#if routeInfo?.loading}
        <!-- Loading state -->
        <div class="space-y-2">
          <p class="text-sm font-bold text-gray-900 dark:text-white">Calculating route...</p>
          <div class="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div class="h-full bg-blue-500 animate-pulse w-full"></div>
          </div>
        </div>
      {:else if routeInfo && !routeInfo.loading}
        <!-- Route info display -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <p class="text-sm font-bold text-gray-900 dark:text-white">Route Info</p>
            <span class="text-xs text-gray-500 dark:text-gray-400">
              {routeInfo.computeTime}ms
            </span>
          </div>

          <div class="space-y-2">
            <div class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <span class="text-lg">📏</span>
              <span>
                <strong>{(routeInfo.distance / 1000).toFixed(2)}</strong> km
              </span>
            </div>

            <div class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <span class="text-lg">⏱️</span>
              <span>
                ~<strong>{Math.round((routeInfo.distance / 1000 / 5) * 60)}</strong> min walking
              </span>
            </div>

            <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>🔗</span>
              <span>{routeInfo.nodes} waypoints</span>
            </div>

            {#if routeInfo.iterations}
              <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span>🔄</span>
                <span>{routeInfo.iterations.toLocaleString()} iterations</span>
              </div>
            {/if}
          </div>

          <button
            onclick={onClear}
            class="w-full mt-3 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fill-rule="evenodd"
                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                clip-rule="evenodd"
              />
            </svg>
            Clear Route
          </button>
        </div>
      {:else}
        <!-- Instructions -->
        <div class="space-y-3">
          <p class="text-sm font-bold text-gray-900 dark:text-white">Set Route Points</p>

          <div class="space-y-2">
            <div class="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
              <span class="text-lg flex-shrink-0">🟢</span>
              <span>Tap on the map to set <strong>start point</strong></span>
            </div>

            <div class="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
              <span class="text-lg flex-shrink-0">🔴</span>
              <span>Tap again to set <strong>destination</strong></span>
            </div>
          </div>

          <div class="pt-2 border-t border-gray-200 dark:border-gray-700">
            <p class="text-xs text-gray-500 dark:text-gray-400">💡 The route will be calculated automatically</p>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .navigation-control {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-end;
  }

  .nav-toggle-btn {
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    border: none;
    cursor: pointer;
    min-width: 150px;
  }

  .nav-toggle-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .nav-info-panel {
    padding: 1rem;
    max-width: 320px;
    width: 100%;
    animation: slideIn 0.2s ease-out;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Mobile responsive */
  @media (max-width: 640px) {
    .nav-info-panel {
      max-width: calc(100vw - 2rem);
    }
  }
</style>
