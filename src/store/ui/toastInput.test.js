import { describe, it, expect } from 'vitest';
import { normalizeToastKind, normalizeToastText, sanitizeToastMeta } from '@/store/ui/toastInput';

// The full input matrix runs through the store in errorToast.test.js; these pin each function alone

describe('normalizeToastText', () => {
  it('reads an Error, a DOMException and a plain error object alike', () => {
    expect(normalizeToastText(new Error('Boom'))).toBe('Boom');
    expect(normalizeToastText(new DOMException('', 'NotAllowedError'))).toBe('NotAllowedError');
    expect(normalizeToastText({ msg: ' Denied ' })).toBe('Denied');
  });

  it('nothing usable is an empty text, never a fallback of its own', () => {
    expect(normalizeToastText(new Error())).toBe('');
    expect(normalizeToastText(new DOMException())).toBe('');
    expect(normalizeToastText({})).toBe('');
  });
});

describe('normalizeToastKind', () => {
  it.each(['error', 'warn', 'info'])('keeps %s', (kind) => {
    expect(normalizeToastKind(kind)).toBe(kind);
  });

  it.each([undefined, 'fatal', 'ERROR'])('turns %s into error', (kind) => {
    expect(normalizeToastKind(kind)).toBe('error');
  });
});

describe('sanitizeToastMeta', () => {
  it('drops unknown keys, hostile markup included', () => {
    expect(sanitizeToastMeta({ code: 'X', html: '<img src=x onerror=alert(1)>' })).toEqual({ code: 'X' });
  });

  it('cuts a string at 200 characters, exactly', () => {
    expect(sanitizeToastMeta({ code: 'c'.repeat(200) }).code).toHaveLength(200);
    expect(sanitizeToastMeta({ code: 'c'.repeat(201) }).code).toHaveLength(200);
  });

  it.each([null, undefined, 'scope', 42])('a non-object (%s) is no meta', (meta) => {
    expect(sanitizeToastMeta(meta)).toBeNull();
  });
});
