import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { errorToast } from '@/store/ui/errorToast';

// Module-level singleton: clear() also resets the rate limiter
beforeEach(() => errorToast.clear());

const current = () => get(errorToast);

describe('show', () => {
  it('opens a toast with the text, kind and meta', () => {
    errorToast.show('Disk full', 'warn', { scope: 'Storage', code: 'X1' });

    expect(current()).toEqual({
      opened: true,
      content: 'Disk full',
      kind: 'warn',
      meta: { scope: 'Storage', code: 'X1' },
      queue: [],
    });
  });

  it('error, warn and info set the kind', () => {
    errorToast.error('e');
    expect(current().kind).toBe('error');

    errorToast.clear();
    errorToast.warn('w');
    expect(current().kind).toBe('warn');

    errorToast.clear();
    errorToast.info('i');
    expect(current().kind).toBe('info');
  });

  it('an unknown kind falls back to error', () => {
    errorToast.show('x', 'fatal');

    expect(current().kind).toBe('error');
  });
});

describe('message normalization', () => {
  it.each([
    ['  trimmed  ', 'trimmed'],
    // Nothing usable: an empty text, the toast component shows the translated "unknown error"
    ['   ', ''],
    [null, ''],
    [undefined, ''],
    [new Error('Boom'), 'Boom'],
    [Object.assign(new Error(''), { name: 'QuotaError' }), 'QuotaError'],
    [new Error(''), ''],
    [new DOMException('', 'QuotaExceededError'), 'QuotaExceededError'],
    [new DOMException('Quota exceeded', 'QuotaExceededError'), 'Quota exceeded'],
    [{ message: ' from message ' }, 'from message'],
    [{ error: 'from error' }, 'from error'],
    [{ detail: 'from detail' }, 'from detail'],
    [{ status: 500 }, '{"status":500}'],
    [{}, ''],
    [42, '42'],
  ])('%o → %s', (input, expected) => {
    errorToast.show(input);

    expect(current().content).toBe(expected);
  });

  it('an object that can not be serialized does not throw', () => {
    const circular = {};
    circular.self = circular;

    errorToast.show(circular);

    expect(current().content).toBe('');
  });

  it('no English text of its own, ever', () => {
    for (const input of [null, '', new Error(''), {}, new DOMException('', 'Error')]) {
      errorToast.clear();
      errorToast.show(input);

      expect(current().content).not.toMatch(/unknown|exception/i);
    }
  });
});

describe('meta', () => {
  it('keeps only the known keys and cuts long strings', () => {
    errorToast.show('x', 'error', { scope: 's'.repeat(300), data: { id: 1 }, html: '<img onerror>' });

    expect(current().meta).toEqual({ scope: 's'.repeat(200), data: { id: 1 } });
  });

  it('meta without known keys becomes null', () => {
    errorToast.show('x', 'error', { html: 'x' });

    expect(current().meta).toBeNull();
  });
});

describe('action', () => {
  const handler = () => {};

  it('keeps a valid action with its label', () => {
    errorToast.show('x', 'error', { action: { label: 'Open', type: 'openSettings', handler } });

    expect(current().meta.action).toEqual({ label: 'Open', type: 'openSettings', handler });
  });

  it('type defaults to custom', () => {
    errorToast.show('x', 'error', { action: { label: 'Open', handler } });

    expect(current().meta.action.type).toBe('custom');
  });

  // No English fallback: the label must come translated from the caller; the toast itself stays
  it.each([undefined, '', '   ', 42])('an action without a usable label (%s) is dropped', (label) => {
    errorToast.show('x', 'error', { action: { label, type: 'openSettings', handler } });

    expect(current().content).toBe('x');
    expect(current().meta.action).toBeNull();
  });

  it('an action without a handler is dropped', () => {
    errorToast.show('x', 'error', { action: { label: 'Open', handler: 'not a function' } });

    expect(current().meta.action).toBeNull();
  });
});

describe('queue and dedup', () => {
  it('the same visible message is not shown twice', () => {
    errorToast.error('Same');
    errorToast.error('Same');

    expect(current().queue).toEqual([]);
  });

  it('the same text of another kind is queued', () => {
    errorToast.error('Same');
    errorToast.warn('Same');

    expect(current().queue).toEqual([{ content: 'Same', kind: 'warn', meta: null }]);
  });

  it('queues messages while one is open, without repeating the last queued one', () => {
    errorToast.error('First');
    errorToast.error('Second');
    errorToast.error('Second');
    errorToast.error('Third');

    expect(current().queue.map((item) => item.content)).toEqual(['Second', 'Third']);
  });

  it('hide shows the next queued message, then closes', () => {
    errorToast.error('First');
    errorToast.warn('Second', { scope: 'S' });

    errorToast.hide();
    expect(current()).toMatchObject({ opened: true, content: 'Second', kind: 'warn', meta: { scope: 'S' }, queue: [] });

    errorToast.hide();
    expect(current()).toMatchObject({ opened: false, content: '', meta: null });
  });

  it('clear drops the open toast and the queue', () => {
    errorToast.error('First');
    errorToast.error('Second');

    errorToast.clear();

    expect(current()).toEqual({ opened: false, content: '', kind: 'error', meta: null, queue: [] });
  });
});

describe('rate limit', () => {
  // The same message is shown, hidden and shown again, so dedup does not interfere
  function showAndHide(text) {
    errorToast.error(text);
    const shown = current().opened && current().content === text;
    errorToast.hide();
    return shown;
  }

  it('shows the same message at most 3 times per second', () => {
    vi.spyOn(Date, 'now').mockReturnValue(10000);

    const results = [1, 2, 3, 4].map(() => showAndHide('Spam'));

    expect(results).toEqual([true, true, true, false]);
  });

  it('other messages are not limited by it', () => {
    vi.spyOn(Date, 'now').mockReturnValue(10000);
    [1, 2, 3].forEach(() => showAndHide('Spam'));

    expect(showAndHide('Other')).toBe(true);
  });

  it('the limit is per kind', () => {
    vi.spyOn(Date, 'now').mockReturnValue(10000);
    [1, 2, 3].forEach(() => showAndHide('Spam'));

    errorToast.warn('Spam');

    expect(current()).toMatchObject({ opened: true, kind: 'warn' });
  });

  it('is lifted once the window has passed', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(10000);
    [1, 2, 3].forEach(() => showAndHide('Spam'));

    now.mockReturnValue(11001);

    expect(showAndHide('Spam')).toBe(true);
  });

  it('clear resets it', () => {
    vi.spyOn(Date, 'now').mockReturnValue(10000);
    [1, 2, 3].forEach(() => showAndHide('Spam'));

    errorToast.clear();

    expect(showAndHide('Spam')).toBe(true);
  });
});
