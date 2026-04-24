// Global const
export const IS_DEBUG = import.meta.env.DEV;

/**
 * @typedef {Object} Logger
 * @property {(...args: any[]) => void} log - console.log with log index prefix
 * @property {(...args: any[]) => void} warn - console.warn with log index prefix
 * @property {(...args: any[]) => void} error - console.error with log index prefix
 * @property {(tabularData: any, properties?: string[]) => void} table - console.table (no prefix)
 * @property {(...args: any[]) => void} group - console.group with log index prefix
 * @property {() => void} groupEnd - console.groupEnd
 */

/**
 * Creates a namespaced logger. All methods are no-op in production.
 *
 * @param {string} [logIndex='DebugMode'] - Your log index name
 * @return {Logger}
 *
 * @example
 * const mapLog = createLogger('MapLoadData');
 * IS_DEBUG && mapLog.log('Data loaded successfull.', { coords });
 *
 * @example
 * const mapLog = createLogger('MapLoadData);
 * mapLog.group('Fetching tiles);
 * mapLog.table(tilesArray);
 * mapLog.groupEnd();
 */
export function createLogger(logIndex = 'DebugMode') {
  if (!IS_DEBUG) {
    return {
      log: () => {},
      warn: () => {},
      error: () => {},
      table: () => {},
      group: () => {},
      groupEnd: () => {},
    };
  }

  return {
    log: console.log.bind(console, `[${logIndex}]: `),
    warn: console.warn.bind(console, `[${logIndex}]: `),
    error: console.error.bind(console, `[${logIndex}]: `),
    table: console.table.bind(console),
    group: console.group.bind(console, `[${logIndex}]: `),
    groupEnd: console.groupEnd.bind(console),
  };
}
