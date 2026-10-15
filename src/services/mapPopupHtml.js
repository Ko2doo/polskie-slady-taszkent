/**
 * mapPopupHtml
 *
 * The HTML of a marker popup (and the escaping it relies on) was identical between
 * MapPointsBuilder (historical places) and CustomPointsBuilder (user markers) - shared here
 * once instead of kept in sync by hand in two ~700-line classes.
 *
 * Pure functions: no dependency on a builder instance, a map, or any other state.
 */

/**
 * Escape text for safe use inside the HTML template below
 * (important: article/marker titles can be entered by the user)
 * @param {string} text - Text to escape
 * @returns {string} - Escaped HTML
 */
export function escapeHtml(text) {
  if (!text) return '';

  const div = document.createElement('div');

  div.textContent = text;

  return div.innerHTML;
}

/**
 * Build the HTML content of a marker popup
 * @param {Object} options
 * @param {string} options.title - Marker title
 * @param {string} options.id - Marker id (read back from the "Read more" button on click)
 * @param {string} options.preview - Preview image URL, falsy for no preview
 * @param {Function} options.popupLinkFn - i18n function returning the "Read more" button text
 * @returns {string} - HTML string
 */
export function createPopupHTML({ title, id, preview, popupLinkFn }) {
  const popupLinkText = typeof popupLinkFn === 'function' ? popupLinkFn() : 'Read more';

  const previewHTML = preview
    ? `<img
        src="${escapeHtml(preview)}"
        alt="${escapeHtml(title)}"
        class="map-popup-title w-full h-40 object-bottom object-top rounded-t-3xl"
        loading="lazy">`
    : '';

  return `
    <div class="map-popup-content flex flex-col">
      ${previewHTML}

      <div class="map-content-wrapper flex flex-col gap-2">
        <p class="map-popup-title w-full text-gray-900 dark:text-gray-200 mb-2 text-[15px] font-medium sm:font-bold">
          ${escapeHtml(title)}
        </p>

        <button
          class="map-popup-title k-button text-center bg-primary active:bg-ios-primary-shade
                 k-color-brand-blue rounded-full text-white dark:text-white pt-[4px] pb-[4px]
                 pl-4 pr-4 cursor-pointer text-[16px]"
          data-article-id="${escapeHtml(id)}">

          ${escapeHtml(popupLinkText)}
        </button>
      </div>
    </div>
  `.trim();
}
