/**
 * Global Error Toast Store
 *
 * A centralized error notification system with queue management,
 * deduplication, rate limiting, type-safe error handling, and action support.
 *
 * NEW FEATURES (v2):
 * - Action buttons support (e.g., "Open Settings", "Retry")
 * - Custom action handlers
 * - Built-in common actions (openSettings, retry)
 *
 * FEATURES:
 * - Accepts string | Error | unknown input types
 * - Automatic error normalization and sanitization
 * - Message deduplication while toast is open
 * - Queue management for multiple errors
 * - Rate limiting to prevent spam (max 3 same messages per second)
 * - Type validation with automatic fallback
 * - Helper methods for different severity levels
 * - Metadata support (scope, code, data)
 * - Action buttons with callbacks
 *
 * USAGE EXAMPLES:
 *
 * // Basic usage
 * errorToast.show('Something went wrong');
 *
 * // With action button
 * errorToast.error('Permission denied', {
 *   scope: 'GPSNavigation',
 *   code: ERROR_CODES.OS_PLUG_GLOC_0003,
 *   action: {
 *     label: 'Open Settings',
 *     handler: () => openAppSettings()
 *   }
 * });
 *
 * // With built-in openSettings action
 * import { openAppSettings } from '@/services/locationPermissions';
 *
 * errorToast.error('Location permission required', {
 *   scope: 'GPSNavigation',
 *   code: ERROR_CODES.OS_PLUG_GLOC_0003,
 *   action: {
 *     type: 'openSettings',
 *     handler: openAppSettings
 *   }
 * });
 *
 * // Manual control
 * errorToast.hide();  // Hide current toast, show next in queue
 * errorToast.clear(); // Clear everything including queue
 */

import { writable } from 'svelte/store';
import { createLogger, IS_DEBUG } from '@/utils/debugMode';

const errorToastLogger = createLogger('ErrorToast');

/**
 * @typedef {'error' | 'warn' | 'info'} ToastKind
 *
 * @typedef {Object} ToastAction
 * @property {string} [label] - Button label (auto-generated for common types)
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
 * @property {string} content
 * @property {ToastKind} kind
 * @property {ToastMeta|null} meta
 */

const VALID_KINDS = ['error', 'warn', 'info'];
const RATE_LIMIT_WINDOW = 1000; // 1 second
const MAX_SAME_MESSAGE = 3; // Max same message per window

// Default action labels for common types
const ACTION_LABELS = {
  openSettings: 'Open Settings',
  retry: 'Retry',
};

/**
 * Normalize various error types to string message
 * @param {string | Error | unknown} input
 * @returns {string}
 */
function normalizeError(input) {
  if (input == null) return 'Unknown error';

  if (typeof input === 'string') {
    const trimmed = input.trim();
    return trimmed || 'Unknown error';
  }

  if (input instanceof Error) {
    const msg = input.message?.trim();
    if (msg) return msg;

    const name = input.name?.trim();
    if (name && name !== 'Error') return name;

    return 'Unknown error';
  }

  if (typeof DOMException !== 'undefined' && input instanceof DOMException) {
    return input.message || input.name || 'DOM Exception';
  }

  if (typeof input === 'object') {
    const candidates = [input.message, input.error, input.msg, input.description, input.detail];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }

    try {
      const str = JSON.stringify(input);
      return str !== '{}' ? str : 'Unknown error';
    } catch {
      return 'Unknown error';
    }
  }

  return String(input);
}

/**
 * Validate and normalize toast kind
 * @param {ToastKind} kind
 * @returns {ToastKind}
 */
function validateKind(kind) {
  if (VALID_KINDS.includes(kind)) {
    return kind;
  }

  IS_DEBUG && errorToastLogger.warn(`Invalid kind "${kind}", defaulting to "error"`);
  return 'error';
}

/**
 * Sanitize and normalize action
 * @param {ToastAction} action
 * @returns {ToastAction|null}
 */
function sanitizeAction(action) {
  if (!action || typeof action !== 'object') return null;

  // Validate handler
  if (typeof action.handler !== 'function') {
    IS_DEBUG && errorToastLogger.warn('Action handler must be a function');
    return null;
  }

  // Auto-generate label for known types
  let label = action.label;
  if (!label && action.type && ACTION_LABELS[action.type]) {
    label = ACTION_LABELS[action.type];
  }

  // Default label
  if (!label) {
    label = 'Action';
  }

  return {
    label,
    type: action.type || 'custom',
    handler: action.handler,
  };
}

/**
 * Sanitize meta object to prevent XSS or large payloads
 * @param {ToastMeta|null} meta
 * @returns {ToastMeta|null}
 */
function sanitizeMeta(meta) {
  if (!meta || typeof meta !== 'object') return null;

  const sanitized = {};
  const allowedKeys = ['scope', 'code', 'data', 'action'];

  for (const key of allowedKeys) {
    if (key in meta) {
      const value = meta[key];

      // Handle action separately
      if (key === 'action') {
        sanitized.action = sanitizeAction(value);
        continue;
      }

      // Ensure strings aren't too long (prevent UI overflow)
      if (typeof value === 'string') {
        sanitized[key] = value.slice(0, 200);
      } else {
        sanitized[key] = value;
      }
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

/**
 * Create error toast store with queue management and rate limiting
 */
function createErrorToast() {
  const store = writable({
    opened: false,
    content: '',
    kind: 'error', // 'error' | 'warn' | 'info'
    meta: null,
    queue: [],
    recentMessages: new Map(),
  });

  /**
   * Check if message is rate limited
   * @param {string} text
   * @param {ToastKind} kind
   * @returns {boolean}
   */
  function isRateLimited(text, kind) {
    const key = `${kind}:${text}`;
    const now = Date.now();
    let isLimited = false;

    store.update((s) => {
      const recent = s.recentMessages.get(key);

      if (!recent) {
        s.recentMessages.set(key, { count: 1, firstSeen: now });
        return s;
      }

      // Reset if outside window
      if (now - recent.firstSeen > RATE_LIMIT_WINDOW) {
        s.recentMessages.set(key, { count: 1, firstSeen: now });
        return s;
      }

      // Increment count
      recent.count++;
      isLimited = recent.count > MAX_SAME_MESSAGE;

      return s;
    });

    return isLimited;
  }

  /**
   * Show toast message
   * @param {string | Error | unknown} content - Error content
   * @param {ToastKind} [kind='error'] - Toast severity
   * @param {ToastMeta} [meta=null] - Additional metadata
   */
  function show(content, kind = 'error', meta = null) {
    const text = normalizeError(content);
    const validKind = validateKind(kind);
    const safeMeta = sanitizeMeta(meta);

    // Rate limit check
    if (isRateLimited(text, validKind)) {
      IS_DEBUG && errorToastLogger.warn('Rate limited:', text);
      return;
    }

    store.update((s) => {
      // Dedup: same visible message + kind
      if (s.opened && s.content === text && s.kind === validKind) {
        return s;
      }

      // If already open, enqueue
      if (s.opened) {
        const last = s.queue.length ? s.queue[s.queue.length - 1] : null;
        if (last && last.content === text && last.kind === validKind) {
          return s;
        }

        return {
          ...s,
          queue: [...s.queue, { content: text, kind: validKind, meta: safeMeta }],
        };
      }

      return {
        ...s,
        opened: true,
        content: text,
        kind: validKind,
        meta: safeMeta,
      };
    });
  }

  /**
   * Hide current toast and show next in queue
   */
  function hide() {
    store.update((s) => {
      if (!s.opened && s.queue.length === 0) return s;

      if (s.queue.length === 0) {
        return { ...s, opened: false, content: '', meta: null };
      }

      const [next, ...rest] = s.queue;

      return {
        ...s,
        opened: true,
        content: next.content,
        kind: next.kind,
        meta: next.meta,
        queue: rest,
      };
    });
  }

  /**
   * Clear all toasts including queue
   */
  function clear() {
    store.set({
      opened: false,
      content: '',
      kind: 'error',
      meta: null,
      queue: [],
      recentMessages: new Map(),
    });
  }

  /**
   * Show error toast
   * @param {string | Error | unknown} content
   * @param {ToastMeta} [meta=null]
   */
  function error(content, meta = null) {
    return show(content, 'error', meta);
  }

  /**
   * Show warning toast
   * @param {string | Error | unknown} content
   * @param {ToastMeta} [meta=null]
   */
  function warn(content, meta = null) {
    return show(content, 'warn', meta);
  }

  /**
   * Show info toast
   * @param {string | Error | unknown} content
   * @param {ToastMeta} [meta=null]
   */
  function info(content, meta = null) {
    return show(content, 'info', meta);
  }

  /**
   * Show error from Error object with automatic code extraction
   * @param {Error | unknown} error
   * @param {string} [scope=null] - Component/module name
   */
  function fromError(error, scope = null) {
    const meta = { scope };

    // Try to extract error code from error object
    if (error?.code) {
      meta.code = error.code;
    }

    return show(error, 'error', meta);
  }

  return {
    subscribe: store.subscribe,
    show,
    hide,
    clear,
    error,
    warn,
    info,
    fromError,
  };
}

export const errorToast = createErrorToast();
