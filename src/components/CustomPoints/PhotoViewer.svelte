<script>
  /**
   * Fullscreen photo viewer: swipe between photos, pinch or double-tap to zoom.
   * Universal: works for custom points (photos resolved on-device) and historical articles
   * (static assets), see PhotoThumb / source.
   *
   * Registers itself with the overlay stack while open, so the Android back button closes it
   * (and only it, not whatever opened it) first.
   */

  import { Pagination, Zoom } from 'swiper/modules';
  import 'swiper/css';
  import 'swiper/css/pagination';
  import 'swiper/css/zoom';

  import PhotoThumb from './PhotoThumb.svelte';
  import Close from '@/lib/icons/Close.svelte';
  import { portal } from '@/utils/portal';
  import { useOverlay } from '@/services/useOverlay';
  import { swiperInstance } from '@/utils/swiperAction';

  let {
    i18n,
    photos,
    source = 'custom',
    alt = '',
    initialIndex = 0,
    opened = $bindable(false),
  } = $props();

  const { open: registerOverlay, close: unregisterOverlay } = useOverlay(() => {
    opened = false;
  });

  // A real element, not a class-name selector: Swiper resolves a string selector against the
  // whole document, which would misbehave if more than one slider/viewer existed at once
  let dotsEl = $state(null);

  // Driven by the prop rather than by the close button alone: the viewer can also be
  // closed by whoever owns `opened` (e.g. a parent that unmounts it)
  $effect(() => {
    if (opened) registerOverlay();
    else unregisterOverlay();
  });

  function close() {
    opened = false;
  }
</script>

{#if opened}
  <!-- Portaled to <body>: the article popup it opens from is a transformed, overflow-hidden -->
  <!-- container, which would otherwise break `fixed` positioning and could clip this overlay -->
  <div use:portal class="fixed inset-0 z-50 bg-black" role="dialog" aria-modal="true">
    <button
      type="button"
      class="absolute right-4 top-safe-4 z-10 flex size-10 items-center
             justify-center rounded-full bg-black/50 text-white"
      aria-label={$i18n.t("ui:photoViewer:close")}
      onclick={close}
    >
      <Close className="size-5" />
    </button>

    {#if photos.length > 1}
      <div bind:this={dotsEl} class="absolute inset-x-0 bottom-safe-4 z-10 flex justify-center"></div>
    {/if}

    <div
      use:swiperInstance={{
        modules: [Zoom, Pagination],
        zoom: true,
        initialSlide: initialIndex,
        pagination: dotsEl ? { el: dotsEl, clickable: true } : false,
      }}
      class="size-full"
    >
      <div class="swiper-wrapper">
        {#each photos as path (path)}
          <div class="swiper-slide flex items-center justify-center">
            <div class="swiper-zoom-container">
              <PhotoThumb {path} {source} {alt} class="max-h-full max-w-full object-contain" />
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}
