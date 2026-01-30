<script>
  import { Button } from "konsta/svelte";

  let { i18n, activeMode, activeRouteInfo, onClear, onGPSClear } = $props();
</script>

<article class="space-y-2">
  <div class="space-y-1">
    <div class="flex items-center gap-2">
      <span class="text-sm text-gray-700 dark:text-gray-300">
        {$i18n.t("ui:map:infoPanel:routeCalculated")}
      </span>
      <span class="text-xs text-gray-500 dark:text-gray-400">
        {activeRouteInfo.computeTime}{$i18n.t("ui:map:infoPanel:time")}
      </span>
    </div>

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

  <Button
    inline
    small
    raised
    rounded
    colors={{ fillBgIos: "bg-red-500 active:bg-ios-primary-shade", textIos: "text-neutral-400" }}
    onClick={activeMode === "manual" ? onClear : onGPSClear}
  >
    {$i18n.t("ui:map:infoPanel:clear")}
  </Button>
</article>
