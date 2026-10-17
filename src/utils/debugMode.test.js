import { describe, it, expect, vi } from 'vitest';

// IS_DEBUG is read from import.meta.env.DEV once, at module load: each case stubs the env and
// imports a fresh copy of the module.
async function loadDebugMode(isDev) {
  vi.stubEnv('DEV', isDev);
  vi.resetModules();
  return import('@/utils/debugMode');
}

describe('debugMode in development', () => {
  it('exposes IS_DEBUG = true', async () => {
    const { IS_DEBUG } = await loadDebugMode(true);

    expect(IS_DEBUG).toBe(true);
  });

  it('prefixes log/warn/error/group with the log index', async () => {
    const { createLogger } = await loadDebugMode(true);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const group = vi.spyOn(console, 'group').mockImplementation(() => {});

    const logger = createLogger('Map');
    logger.log('a', 1);
    logger.warn('b');
    logger.error('c');
    logger.group('d');

    expect(log).toHaveBeenCalledWith('[Map]: ', 'a', 1);
    expect(warn).toHaveBeenCalledWith('[Map]: ', 'b');
    expect(error).toHaveBeenCalledWith('[Map]: ', 'c');
    expect(group).toHaveBeenCalledWith('[Map]: ', 'd');
  });

  it('passes table/groupEnd through without a prefix', async () => {
    const { createLogger } = await loadDebugMode(true);
    const table = vi.spyOn(console, 'table').mockImplementation(() => {});
    const groupEnd = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});

    const logger = createLogger('Map');
    logger.table([{ a: 1 }]);
    logger.groupEnd();

    expect(table).toHaveBeenCalledWith([{ a: 1 }]);
    expect(groupEnd).toHaveBeenCalledWith();
  });

  it('uses "DebugMode" as the default log index', async () => {
    const { createLogger } = await loadDebugMode(true);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    createLogger().log('x');

    expect(log).toHaveBeenCalledWith('[DebugMode]: ', 'x');
  });
});

describe('debugMode in production', () => {
  it('exposes IS_DEBUG = false', async () => {
    const { IS_DEBUG } = await loadDebugMode(false);

    expect(IS_DEBUG).toBe(false);
  });

  it('returns a logger whose every method is a silent no-op', async () => {
    const { createLogger } = await loadDebugMode(false);
    const spies = ['log', 'warn', 'error', 'table', 'group', 'groupEnd'].map((name) =>
      vi.spyOn(console, name).mockImplementation(() => {}),
    );

    const logger = createLogger('Map');
    ['log', 'warn', 'error', 'table', 'group', 'groupEnd'].forEach((name) => {
      expect(logger[name]('x')).toBeUndefined();
    });

    spies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
  });
});
