<script>
  import { Button } from "konsta/svelte";
  let { i18n } = $props();
</script>

<article class="space-y-2">
  <div class="flex items-center gap-2 text-green-600 dark:text-green-400">
    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
      <path
        fill-rule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clip-rule="evenodd"
      />
    </svg>
    <p class="text-lg font-bold">
      {$i18n.t("ui:map:gps:arrived")}
    </p>
  </div>
</article>
