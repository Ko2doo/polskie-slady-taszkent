/**
 * What `errorToast` accepts, turned into what it stores: the text out of any thrown value, a valid
 * kind, and a meta object with only the known keys. Pure functions, no store.
 *
 * No user-visible fallback text lives here: a value with nothing usable in it becomes an empty
 * text, and the toast component shows the translated "unknown error" for it (`errors:unknownError`)
 * — an English literal here would show in every language.
 *
 * @example
 * const text = normalizeToastText(error); // 'Disk full', or '' when the error says nothing
 * const kind = normalizeToastKind('fatal'); // 'error'
 * const meta = sanitizeToastMeta({ scope: 'Storage', html: '<img>' }); // { scope: 'Storage' }
 */

import { createLogger, IS_DEBUG } from '@/utils/debugMode';

const toastInputLogger = createLogger('ToastInput');

/** @typedef {'error' | 'warn' | 'info'} ToastKind */

const TOAST_KINDS = ['error', 'warn', 'info'];
const DEFAULT_KIND = 'error';
const META_KEYS = ['scope', 'code', 'data', 'action'];
const MAX_META_STRING_LENGTH = 200; // a scope/code longer than this would overflow the toast

// Where a plain object (a plugin's error payload, say) usually keeps its message, in order
const MESSAGE_FIELDS = ['message', 'error', 'msg', 'description', 'detail'];

function trimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// A DOMException is an Error in browsers, but not in every environment (jsdom)
function isErrorLike(value) {
  return value instanceof Error || (typeof DOMException !== 'undefined' && value instanceof DOMException);
}

function textOfError(error) {
  const message = trimmedString(error.message);
  if (message) return message;

  // A named subclass (QuotaExceededError, a DOMException) still says what happened
  const name = trimmedString(error.name);
  return name === 'Error' ? '' : name;
}

function textOfObject(object) {
  for (const field of MESSAGE_FIELDS) {
    const text = trimmedString(object[field]);
    if (text) return text;
  }

  try {
    const json = JSON.stringify(object);
    return json === '{}' ? '' : json;
  } catch (error) {
    IS_DEBUG && toastInputLogger.warn('Toast content could not be serialized:', error);
    return '';
  }
}

/**
 * The text a toast shows for any value a caller passes in — a string, an Error, a plugin's error
 * object, anything thrown.
 *
 * @param {string | Error | unknown} content - what the caller passed to the toast
 * @returns {string} the trimmed text, or '' when there is nothing usable in it (the toast
 *   component then shows the translated "unknown error")
 */
export function normalizeToastText(content) {
  if (content == null) return '';
  if (typeof content === 'string') return content.trim();
  if (isErrorLike(content)) return textOfError(content);
  if (typeof content === 'object') return textOfObject(content);
  return String(content);
}

/**
 * A toast kind, or 'error' for anything that isn't one.
 *
 * @param {unknown} kind - the kind the caller asked for
 * @returns {ToastKind} a valid kind
 */
export function normalizeToastKind(kind) {
  if (TOAST_KINDS.includes(kind)) return kind;

  IS_DEBUG && toastInputLogger.warn(`Invalid kind "${kind}", defaulting to "${DEFAULT_KIND}"`);
  return DEFAULT_KIND;
}

/**
 * The action button, or null when it can't be shown: it needs a handler and a label. The label is
 * user-visible text, so it must come translated from the caller (.claude/rules/i18n.md) — there is
 * no fallback label.
 * @param {unknown} action - the caller's action
 * @returns {{ label: string, type: string, handler: Function }|null} the action to store
 */
function sanitizeToastAction(action) {
  if (!action || typeof action !== 'object') return null;

  if (typeof action.handler !== 'function') {
    IS_DEBUG && toastInputLogger.warn('Action handler must be a function');
    return null;
  }

  if (!trimmedString(action.label)) {
    IS_DEBUG && toastInputLogger.warn('Action label is required (a translated string), action dropped');
    return null;
  }

  return { label: action.label, type: action.type || 'custom', handler: action.handler };
}

/**
 * The toast's meta with only the known keys (`scope`, `code`, `data`, `action`), strings cut to
 * MAX_META_STRING_LENGTH, the action checked.
 *
 * @param {unknown} meta - the caller's meta
 * @returns {{ scope?: string, code?: string, data?: any, action?: Object|null }|null} the meta to
 *   store, or null when there is no known key in it
 */
export function sanitizeToastMeta(meta) {
  if (!meta || typeof meta !== 'object') return null;

  const sanitized = {};
  for (const key of META_KEYS) {
    if (!(key in meta)) continue;

    const value = meta[key];
    if (key === 'action') {
      sanitized.action = sanitizeToastAction(value);
    } else if (typeof value === 'string') {
      sanitized[key] = value.slice(0, MAX_META_STRING_LENGTH);
    } else {
      sanitized[key] = value;
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : null;
}
