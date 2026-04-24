/**
 * Global store for Handbook layout view
 * Sync-first, storage is best-effort
 */

import { getStorage, setStorage } from '@/capacitor/utils/appStorage';
import { createLogger, IS_DEBUG } from '@/utils/debugMode';

const layoutLogger = createLogger('LayoutView');

// Capacitor storage key
const STORAGE_KEY = 'handbook.layoutMode';

// Layout mode
const GRID = {
  mode: 'layoutGrid',
  classes: 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
};

const ROWS = {
  mode: 'layoutRows',
  classes: 'grid grid-cols-1 md:grid-cols-1',
};

// Always-valid default
let value = GRID;

const subscribers = new Set();

function notify() {
  subscribers.forEach((fn) => fn(value));
}

// Best-effort async hydration (does NOT block UI)
(async function hydrate() {
  try {
    const stored = await getStorage(STORAGE_KEY);

    const next = stored === 'layoutRows' ? ROWS : GRID;

    if (next.mode !== value.mode) {
      value = next;
      notify();
    }
  } catch (error) {
    IS_DEBUG && layoutLogger.error('hydrate() error:', error);
  }
})();

export const layoutView = {
  subscribe(fn) {
    subscribers.add(fn);
    fn(value);

    return () => subscribers.delete(fn);
  },

  set(mode) {
    const next = mode === 'layoutRows' ? ROWS : GRID;

    if (next.mode === value.mode) return;

    value = next;
    setStorage(STORAGE_KEY, value.mode);
    notify();
  },
};
