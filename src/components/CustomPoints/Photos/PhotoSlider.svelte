<script>
  /**
   * Photo display for an article: one photo is shown directly, several become a swipeable
   * slider with dots. Tapping any photo opens the fullscreen PhotoViewer.
   *
   * Universal: works for custom points (photos resolved on-device) and historical articles
   * (static assets) through PhotoThumb / source.
   */

  import { Pagination } from "swiper/modules";

  import PhotoThumb from "./PhotoThumb.svelte";
  import PhotoViewer from "./PhotoViewer.svelte";
  import { createToggleOverlay } from "@/lib/state/createToggleOverlay";
  import { swiperInstance } from "@/utils/swiperAction";

  let { i18n, photos, source = "custom", alt = "", class: className = "" } = $props();

  let dotsEl = $state(null);

  // Owns whether the viewer is open AND its overlay-stack registration (Android back closes it)
  const viewer = createToggleOverlay();
  let viewerIndex = $state(0);

  function openViewer(index) {
    viewerIndex = index;
    viewer.open();
  }
</script>

{#if photos.length === 1}
  <button type="button" class="block w-full" onclick={() => openViewer(0)}>
    <PhotoThumb path={photos[0]} {source} {alt} class={className} />
  </button>
{:else if photos.length > 1}
  <div class="flex flex-col">
    <!-- Declared before the slider (even though it is shown below it) so the dots element -->
    <!-- already exists when the use:swiperInstance action below runs and asks for it -->
    <div bind:this={dotsEl} class="order-2 mt-2 flex justify-center"></div>

    <div
      use:swiperInstance={{
        modules: [Pagination],
        slidesPerView: 1,
        slidesPerGroup: 1,
        spaceBetween: 0,
        centeredSlides: false,
        pagination: dotsEl ? { el: dotsEl, clickable: true } : false,
      }}
      class="swiper order-1 {className}"
    >
      <div class="swiper-wrapper">
        {#each photos as path, index (path)}
          <div class="swiper-slide">
            <button type="button" class="block size-full" onclick={() => openViewer(index)}>
              <PhotoThumb {path} {source} {alt} class="size-full rounded-2xl object-cover" />
            </button>
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

{#if photos.length > 0}
  <PhotoViewer
    {i18n}
    {photos}
    {source}
    {alt}
    initialIndex={viewerIndex}
    opened={viewer.value}
    onClose={() => viewer.close()}
  />
{/if}
