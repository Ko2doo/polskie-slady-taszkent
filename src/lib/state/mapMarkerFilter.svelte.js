import { getStorage, setStorage } from '@/capacitor/utils/appStorage';
import { createLogger, IS_DEBUG } from '@/utils/debugMode';

const mapMarkerFilterLogger = createLogger('MapMarkerFilter');

// Capacitor storage key
const STORAGE_KEY = 'map.markerFilter';

/**
 * Map markers filter ids
 *  - all        - article markers and user-created points
 *  - custom     - user-created points only
 *  - historical - article markers only
 */
export const MARKER_FILTER = {
  ALL: 'all',
  CUSTOM: 'custom',
  HISTORICAL: 'historical',
};

const filterIds = Object.values(MARKER_FILTER);

/**
 * Filter selected by the user (the map editor mode does not change it, see Map.svelte).
 *
 * Module-level singleton on purpose: the filter list in the side panel and the map must read the same value.
 * Sync-first: the UI never waits for the storage, the saved value is restored in the background
 * (the same approach as the Handbook layout store).
 */
let selected = $state(MARKER_FILTER.ALL);
// Set once the user changes the filter: a restore that arrives later must not undo their pick
let isPickedByUser = false;

(async function hydrate() {
  const stored = await getStorage(STORAGE_KEY);

  if (isPickedByUser) {
    IS_DEBUG && mapMarkerFilterLogger.log('Filter already picked by the user, restore skipped');
    return;
  }

  // Ignore anything unknown (e.g. a value saved by another app version)
  if (!filterIds.includes(stored)) return;

  selected = stored;

  IS_DEBUG && mapMarkerFilterLogger.log('Filter restored from storage:', stored);
})();

export const mapMarkerFilter = {
  get selected() {
    return selected;
  },

  /**
   * Select a filter and save it to the Capacitor storage
   * @param {string} id - One of MARKER_FILTER values
   */
  select(id) {
    if (!filterIds.includes(id) || id === selected) return;

    selected = id;
    isPickedByUser = true;
    setStorage(STORAGE_KEY, id);

    IS_DEBUG && mapMarkerFilterLogger.log('Filter selected:', id);
  },
};
