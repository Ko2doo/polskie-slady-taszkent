import { App } from '@capacitor/app';
import { dataFilesDriver } from '@/capacitor/utils/appFiles';
import { LIMITS } from '@/services/customPointsFormat';
import { createCustomPointsStorage } from '@/services/customPointsStorage';
import { createLogger, IS_DEBUG } from '@/utils/debugMode';
import { createId } from '@/utils/uuid';

const customPointsStateLogger = createLogger('CustomPointsState');

/**
 * Custom points state
 *
 * This is a module-level singleton on purpose: the map (builder) and the article popup
 * must read the same data. Do not turn it into a factory, every call of a factory
 * would create an independent copy of the state.
 *
 * Points are saved to a JSON file (see customPointsStorage) after every change and loaded when the module
 * is imported. Wait for `ready` before reading `points` at the start of the app.
 *
 * Point shape:
 *   - id          - unique id (UUID v4), used by the map popup to open the article and to merge imported points
 *   - coords      - { lng, lat } in WGS84
 *   - title       - article title
 *   - description - article text (plain text, NOT html)
 *   - preview     - preview image URL, empty string if there is none (local only: never exported)
 *   - createdAt   - unix time in ms
 *   - updatedAt   - unix time in ms, changes only when the title, the description or the coords change
 */
const points = $state([]);

// Problems found by the storage (see customPointsStorage), shown to the user by the app shell
const notices = $state([]);

const storage = createCustomPointsStorage({
  driver: dataFilesDriver,
  onNotice: (code) => notices.push(code),
});

function persist() {
  storage.schedule(() => $state.snapshot(points));
}

function clip(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

async function hydrate() {
  const { status, points: loaded } = await storage.load();

  // Points added before the loading finished stay (it can not really happen, but losing data is worse)
  const loadedIds = new Set(loaded.map((point) => point.id));
  const early = $state.snapshot(points).filter((point) => !loadedIds.has(point.id));

  points.splice(0, points.length, ...loaded, ...early);

  if (early.length > 0) persist();

  IS_DEBUG && customPointsStateLogger.log(`Hydrated: ${status}, ${loaded.length} points`);
}

export const customPointsState = {
  /** Resolves when the saved points are loaded */
  ready: hydrate(),

  get points() {
    return points;
  },

  get notices() {
    return notices;
  },

  /**
   * Take the pending storage notices (and clear them)
   * @returns {Array<string>} - StoreUnsupported | StoreUnreadable | StoreCorrupted | StoreSaveFailed
   */
  takeNotices() {
    return notices.splice(0, notices.length);
  },

  /**
   * Add a new point
   * @param {Object} data - { coords: { lng, lat }, title, description, preview }
   * @returns {Object} - Created point with generated id
   */
  add(data) {
    const now = Date.now();

    const point = {
      id: createId(),
      coords: { lng: data.coords.lng, lat: data.coords.lat },
      title: clip(data.title, LIMITS.title),
      description: clip(data.description, LIMITS.description),
      preview: typeof data.preview === 'string' ? data.preview : '',
      createdAt: now,
      updatedAt: now,
    };

    points.push(point);
    persist();

    IS_DEBUG && customPointsStateLogger.log(`Point "${point.id}" added`);

    return point;
  },

  /**
   * Find a point by id
   * @param {string} id - Point id
   * @returns {Object|null} - Point or null if not found
   */
  getById(id) {
    const found = points.find((point) => point.id === id);

    if (!found) {
      return null;
    }

    return found;
  },

  /**
   * Update the editable data of a point (title, article text, preview).
   * The id and coordinates are not changed.
   * @param {string} id - Point id
   * @param {Object} data - { title, description, preview }, all fields are optional
   * @returns {Object|null} - Updated point or null if not found
   */
  update(id, data) {
    const point = points.find((item) => item.id === id);

    if (!point) {
      return null;
    }

    let isChanged = false;

    if (typeof data.title === 'string') {
      const title = clip(data.title, LIMITS.title);

      if (title !== point.title) {
        point.title = title;
        isChanged = true;
      }
    }

    if (typeof data.description === 'string') {
      const description = clip(data.description, LIMITS.description);

      if (description !== point.description) {
        point.description = description;
        isChanged = true;
      }
    }

    // The preview is local only, it does not make the point "newer"
    if (typeof data.preview === 'string') {
      point.preview = data.preview;
    }

    if (isChanged) {
      // Always moves forward, even if the clock of the device went back
      point.updatedAt = Math.max(Date.now(), point.updatedAt + 1);
    }

    persist();

    IS_DEBUG && customPointsStateLogger.log(`Point "${id}" updated`);

    return point;
  },

  /**
   * Remove a point by id
   * @param {string} id - Point id
   */
  remove(id) {
    const index = points.findIndex((point) => point.id === id);

    if (index === -1) return;

    points.splice(index, 1);
    persist();

    IS_DEBUG && customPointsStateLogger.log(`Point "${id}" removed`);
  },

  /**
   * Write the points to the file right now
   * @returns {Promise<void>}
   */
  flush() {
    return storage.flush();
  },
};

let isPersistenceBound = false;

/**
 * Save the points as soon as the app goes to the background: the system can kill it there,
 * and a debounced save could still be waiting.
 * Call once at the start of the app.
 */
export function initCustomPointsPersistence() {
  if (isPersistenceBound) return;

  isPersistenceBound = true;

  App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) {
      customPointsState.flush();
    }
  });
}
