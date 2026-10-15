<script>
  /**
   * A small photo of a custom point. The url is resolved without blocking the form:
   * a grey placeholder is shown until it is ready.
   */

  import { getPhotoUrl, releasePhotoUrl } from "@/services/customPointsPhotos";

  let { path, alt = "", class: className = "", source = "custom" } = $props();

  let src = $state("");

  $effect(() => {
    let isActual = true;

    src = "";

    if (source === "asset") {
      src = path;
      return () => (isActual = false);
    }

    // On the web, getPhotoUrl hands out a Blob url and counts this as one use of it; this
    // effect's own path (captured here, not re-read from the prop) is released on cleanup -
    // the same photo can be shown elsewhere at the same time (e.g. a thumbnail and, while open,
    // the fullscreen viewer), so the url must survive until every such use is done with it
    const ownPath = path;

    getPhotoUrl(ownPath)
      .then((url) => {
        if (isActual) src = url || "";
      })
      .catch(() => {
        // A photo that can not be read stays a placeholder
      });

    return () => {
      isActual = false;
      releasePhotoUrl(ownPath);
    };
  });
</script>

{#if src}
  <img {src} {alt} class={className} loading="lazy" decoding="async" />
{:else}
  <div class="{className} animate-pulse bg-gray-200 dark:bg-gray-700"></div>
{/if}
