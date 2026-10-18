/**
 * Global Error Toast Store — the app's one user-facing error/warning/info channel, rendered by
 * `components/Toasts/ErrorHandlerToast.svelte`.
 *
 * - One toast at a time; messages arriving while it's open wait in a queue, shown one by one as
 *   each is closed (`hide()`).
 * - Dedup: the message already on screen, or the last one queued, isn't added again.
 * - Rate limit: the same message (text + kind) at most MAX_SAME_MESSAGE times per
 *   RATE_LIMIT_WINDOW_MS (`utils/rateLimiter.js`, kept out of the store — it renders nothing).
 * - Any input is accepted (string, Error, a plugin's error object); `store/ui/toastInput.js` turns
 *   it into the stored text, kind and meta. A value with nothing usable in it is stored as an empty
 *   text; the toast component shows the translated "unknown error" for it.
 *
 * Texts and action labels come translated from the caller — the store adds no text of its own.
 *
 * @example
 * errorToast.error(i18n.t('errors:mapInitFailed'), { scope: 'Map', code: ERROR_CODES.MAP_INIT_FAILED });
 *
 * // With an action button instead of "Close"
 * import { openAppSettings } from '@/capacitor/services/locationPermission';
 *
 * errorToast.error(i18n.t(`errors:${ERROR_CODES.OS_PLUG_GLOC_0003}`), {
 *   scope: 'GPSNavigation',
 *   code: ERROR_CODES.OS_PLUG_GLOC_0003,
 *   action: { type: 'openSettings', label: i18n.t('ui:buttons:openSettings'), handler: openAppSettings },
 * });
 *
 * errorToast.hide(); // close the current toast, show the next queued one
 * errorToast.clear(); // drop everything, the queue and the rate limit included
 */

import { writable } from 'svelte/store';
import { createRateLimiter } from '@/utils/rateLimiter';
import { normalizeToastKind, normalizeToastText, sanitizeToastMeta } from './toastInput';
import { createLogger, IS_DEBUG } from '@/utils/debugMode';

const errorToastLogger = createLogger('ErrorToast');

const RATE_LIMIT_WINDOW_MS = 1000;
const MAX_SAME_MESSAGE = 3; // per RATE_LIMIT_WINDOW_MS

/**
 * @typedef {'error' | 'warn' | 'info'} ToastKind
 *
 * @typedef {Object} ToastAction
 * @property {string} label - Button label, already translated (an action without one is dropped)
 * @property {'openSettings' | 'retry' | 'custom'} [type] - Action type
 * @property {Function} handler - Action callback
 *
 * @typedef {Object} ToastMeta
 * @property {string} [scope] - Component or module name
 * @property {string} [code] - Error code from ERROR_CODES
 * @property {any} [data] - Additional context data
 * @property {ToastAction} [action] - Optional action button
 *
 * @typedef {Object} ToastQueueItem
 * @property {string} content - the text to show ('' — the translated "unknown error")
 * @property {ToastKind} kind - its severity
 * @property {ToastMeta|null} meta - its sanitized meta
 */

const closedState = () => ({ opened: false, content: '', kind: 'error', meta: null, queue: [] });

const isSameMessage = (message, content, kind) => message.content === content && message.kind === kind;

/**
 * The toast state after a new message: shown at once when nothing is open, queued otherwise,
 * dropped when it repeats what's on screen or the last queued message
 * @param {Object} state - the store's current state
 * @param {ToastQueueItem} message - the normalized message
 * @returns {Object} the next state (the same object when nothing changes)
 */
function withMessage(state, message) {
  if (!state.opened) {
    return { ...state, opened: true, content: message.content, kind: message.kind, meta: message.meta };
  }

  const lastQueued = state.queue.at(-1);
  if (isSameMessage(state, message.content, message.kind)) return state;
  if (lastQueued && isSameMessage(lastQueued, message.content, message.kind)) return state;

  return { ...state, queue: [...state.queue, message] };
}

/**
 * The toast state after the current toast is closed: the next queued message, or nothing
 * @param {Object} state - the store's current state
 * @returns {Object} the next state (the same object when nothing changes)
 */
function withoutCurrent(state) {
  if (!state.opened && state.queue.length === 0) return state;

  if (state.queue.length === 0) {
    return { ...state, opened: false, content: '', meta: null };
  }

  const [next, ...rest] = state.queue;
  return { ...state, opened: true, content: next.content, kind: next.kind, meta: next.meta, queue: rest };
}

function createErrorToast() {
  const store = writable(closedState());
  const rateLimiter = createRateLimiter({ windowMs: RATE_LIMIT_WINDOW_MS, maxPerWindow: MAX_SAME_MESSAGE });

  /**
   * Show a toast message (or queue it while another one is open)
   * @param {string | Error | unknown} content - the message: translated text, or an error
   * @param {ToastKind} [kind='error'] - toast severity; anything else becomes 'error'
   * @param {ToastMeta} [meta=null] - scope, code, data and an optional action button
   */
  function show(content, kind = 'error', meta = null) {
    const message = {
      content: normalizeToastText(content),
      kind: normalizeToastKind(kind),
      meta: sanitizeToastMeta(meta),
    };

    if (rateLimiter.isLimited(`${message.kind}:${message.content}`)) {
      IS_DEBUG && errorToastLogger.warn('Rate limited:', message.content);
      return;
    }

    store.update((state) => withMessage(state, message));
  }

  /**
   * Hide the current toast and show the next queued one
   */
  function hide() {
    store.update(withoutCurrent);
  }

  /**
   * Drop the open toast, the queue and the rate limit
   */
  function clear() {
    rateLimiter.reset();
    store.set(closedState());
  }

  /**
   * Show an error toast
   * @param {string | Error | unknown} content - the message
   * @param {ToastMeta} [meta=null] - see show()
   */
  function error(content, meta = null) {
    show(content, 'error', meta);
  }

  /**
   * Show a warning toast
   * @param {string | Error | unknown} content - the message
   * @param {ToastMeta} [meta=null] - see show()
   */
  function warn(content, meta = null) {
    show(content, 'warn', meta);
  }

  /**
   * Show an info toast
   * @param {string | Error | unknown} content - the message
   * @param {ToastMeta} [meta=null] - see show()
   */
  function info(content, meta = null) {
    show(content, 'info', meta);
  }

  return {
    subscribe: store.subscribe,
    show,
    hide,
    clear,
    error,
    warn,
    info,
  };
}

export const errorToast = createErrorToast();
