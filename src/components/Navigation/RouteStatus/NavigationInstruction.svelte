<script>
  let { i18n, activeMode } = $props();
</script>

<article class="space-y-3">
  {#if activeMode === "manual"}
    <div class="space-y-2">
      <div class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <span class="text-lg flex-shrink-0">🟢</span>
        <span>{$i18n.t("ui:map:infoPanel:startProg")}</span>
      </div>

      <div class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <span class="text-lg flex-shrink-0">🔴</span>
        <span>{$i18n.t("ui:map:infoPanel:endProg")}</span>
      </div>
    </div>
  {/if}
</article>
