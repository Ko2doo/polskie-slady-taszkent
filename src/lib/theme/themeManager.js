/**
 * Theme Manager (Konsta UI + Capacitor Preferences)
 *
 * What it does:
 * - Provides a single, global (singleton) theme controller for the whole app.
 * - Supports two modes:
 *   1) Auto (Follow system):
 *      - No persisted value in storage.
 *      - Theme is derived from `prefers-color-scheme: dark`.
 *      - Reacts to system theme changes via matchMedia "change" event.
 *   2) Manual:
 *      - Persisted value in storage: ui.theme = "dark" | "light".
 *      - System theme changes are ignored.
 * - Applies theme by toggling the "dark" class on <html>.
 *   Konsta UI uses this class to render dark styles.
 *
 * Why a singleton:
 * - Ensures matchMedia listener is attached only once.
 * - Any screen (Settings, etc.) can subscribe to current state and update UI.
 */

import { getStorage, setStorage, removeStorageItem } from '@/capacitor/utils/appStorage';

const THEME_KEY = 'ui.theme';
const hasDOM = typeof window !== 'undefined' && typeof document !== 'undefined';

let instance = null;

/** Get the single theme manager instance. */
export function getThemeManager() {
  if (!instance) instance = createThemeManager();
  return instance;
}

function createThemeManager() {
  // Internal state
  let followSystem = true; // true => auto mode (no persisted value)
  let isDark = false; // current effective theme
  let inited = false;

  // Subscriptions
  const subs = new Set();

  // matchMedia handle (created on init)
  const mediaQuery = hasDOM ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  /** Notify all subscribers about current state. */
  const notify = () => {
    const snapshot = { followSystem, isDark };
    subs.forEach((fn) => fn(snapshot));
  };

  /** Apply theme to DOM + update internal state. */
  const apply = (nextIsDark) => {
    isDark = !!nextIsDark;

    if (hasDOM) {
      document.documentElement.classList.toggle('dark', isDark);
    }

    notify();
  };

  /** Read persisted theme; returns boolean (dark) or null if auto. */
  const readStoredTheme = async () => {
    const v = await getStorage(THEME_KEY);
    if (v === 'dark') return true;
    if (v === 'light') return false;
    return null; // auto mode
  };

  /** Sync internal state from storage (manual) or system (auto). */
  const sync = async () => {
    const stored = await readStoredTheme();

    if (stored === true || stored === false) {
      followSystem = false;
      apply(stored);
      return;
    }

    followSystem = true;
    apply(mediaQuery ? mediaQuery.matches : false);
  };

  /** Initialize manager once (attach listener + initial sync). */
  const init = async () => {
    if (inited) return;
    inited = true;

    // Initial theme application as early as possible
    await sync();

    // Listen system theme changes (auto mode only)
    if (mediaQuery) {
      mediaQuery.addEventListener('change', (e) => {
        if (!followSystem) return;
        apply(e.matches);
      });
    }
  };

  return {
    /** Start manager (call once from App root). */
    init,

    /** Subscribe to state changes (returns unsubscribe). */
    subscribe(fn) {
      subs.add(fn);
      fn({ followSystem, isDark }); // push current state immediately
      return () => subs.delete(fn);
    },

    /** Read current state synchronously. */
    getState() {
      return { followSystem, isDark };
    },

    /** Enable/disable auto mode (Follow system). */
    async setFollowSystem(value) {
      followSystem = !!value;

      if (followSystem) {
        // Auto: remove persisted override and apply current system theme
        await removeStorageItem(THEME_KEY);
        apply(mediaQuery ? mediaQuery.matches : false);

        return;
      }

      // Manual: persist current effective theme as the user's choice
      await setStorage(THEME_KEY, isDark ? 'dark' : 'light');
      notify(); // state already applied; just inform subscribers
    },

    /** Set manual theme (works only when followSystem === false). */
    async setDark(value) {
      if (followSystem) return; // manual-only safeguard

      apply(!!value);
      await setStorage(THEME_KEY, isDark ? 'dark' : 'light');
    },
  };
}
