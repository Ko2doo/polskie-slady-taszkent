<script>
  /**
   * A small photo of a custom point. The url is resolved without blocking the form:
   * a grey placeholder is shown until it is ready.
   */

  import { getPhotoUrl } from "@/services/customPointsPhotos";

  let { path, alt = "", class: className = "", source = "custom" } = $props();

  let src = $state("");

  $effect(() => {
    let isActual = true;

    src = "";

    if (source === "asset") {
      src = path;
      return () => (isActual = false);
    }

    getPhotoUrl(path)
      .then((url) => {
        if (isActual) src = url || "";
      })
      .catch(() => {
        // A photo that can not be read stays a placeholder
      });

    return () => {
      isActual = false;
    };
  });
</script>

{#if src}
  <img {src} {alt} class={className} loading="lazy" decoding="async" />
{:else}
  <div class="{className} animate-pulse bg-gray-200 dark:bg-gray-700"></div>
{/if}
