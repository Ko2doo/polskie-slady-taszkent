import { describe, it, expect, vi } from 'vitest';
import { createId, isId } from '@/utils/uuid';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('createId', () => {
  it('uses crypto.randomUUID when available', () => {
    const randomUUID = vi.fn(() => '11111111-2222-4333-8444-555555555555');
    vi.stubGlobal('crypto', { randomUUID, getRandomValues: vi.fn() });

    expect(createId()).toBe('11111111-2222-4333-8444-555555555555');
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });

  it('falls back to getRandomValues and sets the v4 version/variant bits', () => {
    // All-0xff bytes: only the version (byte 6) and variant (byte 8) masks can change them.
    const getRandomValues = vi.fn((bytes) => bytes.fill(0xff));
    vi.stubGlobal('crypto', { getRandomValues });

    const id = createId();

    expect(getRandomValues).toHaveBeenCalledTimes(1);
    expect(id).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
    expect(isId(id)).toBe(true);
  });

  it('keeps the variant bits right for all-zero random bytes', () => {
    vi.stubGlobal('crypto', { getRandomValues: (bytes) => bytes.fill(0) });

    expect(createId()).toBe('00000000-0000-4000-8000-000000000000');
  });

  it('falls back to Math.random when there is no crypto at all', () => {
    vi.stubGlobal('crypto', undefined);
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const id = createId();

    expect(random).toHaveBeenCalledTimes(16);
    expect(id).toMatch(V4);
  });

  it('produces distinct valid ids with the real crypto', () => {
    const ids = new Set(Array.from({ length: 200 }, createId));

    expect(ids.size).toBe(200);
    ids.forEach((id) => expect(id).toMatch(V4));
  });
});

describe('isId', () => {
  it('accepts a v4 UUID in either case', () => {
    expect(isId('3f2504e0-4f89-41d3-9a0c-0305e82c3301')).toBe(true);
    expect(isId('3F2504E0-4F89-41D3-9A0C-0305E82C3301')).toBe(true);
  });

  it('rejects other UUID versions and a wrong variant', () => {
    expect(isId('3f2504e0-4f89-11d3-9a0c-0305e82c3301')).toBe(false); // v1
    expect(isId('3f2504e0-4f89-41d3-7a0c-0305e82c3301')).toBe(false); // variant 0xxx
  });

  it('rejects non-strings and malformed strings', () => {
    [undefined, null, 42, {}, [], '', '3f2504e04f8941d39a0c0305e82c3301'].forEach((value) => {
      expect(isId(value)).toBe(false);
    });
  });

  // Ids end up in file paths and HTML attributes: anything around a valid id must be rejected.
  it('rejects path traversal, HTML and whitespace around a valid id', () => {
    const id = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

    [`../${id}`, `${id}/../../etc`, `${id}"><img src=x onerror=alert(1)>`, ` ${id}`, `${id}\n`, `${id}${id}`].forEach(
      (value) => expect(isId(value)).toBe(false),
    );
  });
});
