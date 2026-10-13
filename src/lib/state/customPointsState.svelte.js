import { createLogger, IS_DEBUG } from '@/utils/debugMode';

const customPointsStateLogger = createLogger('CustomPointsState');

/**
 * Custom points state (temporary in-memory storage)
 *
 * This is a module-level singleton on purpose: the map (builder) and the article popup
 * must read the same data. Do not turn it into a factory, every call of a factory
 * would create an independent copy of the state.
 *
 * Later this storage will be replaced by a database, the public API can stay the same.
 *
 * Point shape:
 *   - id          - unique id, used by the map popup to open the article
 *   - coords      - { lng, lat } in WGS84
 *   - title       - article title
 *   - description - article text (plain text, NOT html)
 *   - preview     - preview image URL, empty string if there is none
 */
const points = $state([]);
let idCounter = 0;

export const customPointsState = {
  get points() {
    return points;
  },

  /**
   * Add a new point
   * @param {Object} data - { coords: { lng, lat }, title, description, preview }
   * @returns {Object} - Created point with generated id
   */
  add(data) {
    idCounter += 1;

    const point = {
      id: `custom-point-${idCounter}`,
      coords: { lng: data.coords.lng, lat: data.coords.lat },
      title: data.title,
      description: typeof data.description === 'string' ? data.description : '',
      preview: typeof data.preview === 'string' ? data.preview : '',
    };

    points.push(point);

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
   * Remove a point by id
   * @param {string} id - Point id
   */
  remove(id) {
    const index = points.findIndex((point) => point.id === id);

    if (index === -1) return;

    points.splice(index, 1);

    IS_DEBUG && customPointsStateLogger.log(`Point "${id}" removed`);
  },
};
