/**
 * swiperInstance: Svelte action that mounts a Swiper instance on an element and destroys it on unmount
 *
 * Swiper has no official Svelte 5 integration (only a custom element and a React wrapper), so the core
 * JS API is driven directly through this action. The slides themselves are plain markup
 * (.swiper-wrapper > .swiper-slide), Svelte owns that DOM as usual.
 *
 * Usage:
 *   <div use:swiperInstance={{ modules: [Pagination], pagination: { el: dotsEl } }}>
 *     <div class="swiper-wrapper">...</div>
 *   </div>
 */

import Swiper from 'swiper';

/**
 * @param {HTMLElement} node - Element to turn into a Swiper container
 * @param {Object} params - Swiper constructor options (modules, pagination, zoom, etc.)
 * @returns {{ destroy: Function }}
 */
export function swiperInstance(node, params) {
  const instance = new Swiper(node, params);

  return {
    destroy() {
      if (!instance.destroyed) instance.destroy(true, true);
    },
  };
}
