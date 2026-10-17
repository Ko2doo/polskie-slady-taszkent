import { describe, it, expect } from 'vitest';
import { InMemoryPMTilesSource } from '@/utils/inMemoryPmtilesSource';

const bytes = (...values) => new Uint8Array(values);

describe('InMemoryPMTilesSource', () => {
  it('returns the key the pmtiles:// url uses', () => {
    expect(new InMemoryPMTilesSource('tashkent-local', new ArrayBuffer(0)).getKey()).toBe('tashkent-local');
  });

  it('serves byte ranges from an ArrayBuffer', async () => {
    const source = new InMemoryPMTilesSource('k', bytes(0, 1, 2, 3, 4, 5).buffer);

    const { data } = await source.getBytes(2, 3);

    expect(data).toBeInstanceOf(ArrayBuffer);
    expect([...new Uint8Array(data)]).toEqual([2, 3, 4]);
  });

  it('accepts a Uint8Array that spans its whole buffer', async () => {
    const source = new InMemoryPMTilesSource('k', bytes(9, 8, 7));

    const { data } = await source.getBytes(1, 2);

    expect([...new Uint8Array(data)]).toEqual([8, 7]);
  });

  it('returns a copy, so the caller cannot mutate the archive', async () => {
    const buffer = bytes(1, 2, 3).buffer;
    const source = new InMemoryPMTilesSource('k', buffer);

    const { data } = await source.getBytes(0, 3);
    new Uint8Array(data)[0] = 99;

    expect(new Uint8Array(buffer)[0]).toBe(1);
  });

  it('clamps a range past the end of the archive', async () => {
    const source = new InMemoryPMTilesSource('k', bytes(1, 2, 3).buffer);

    const { data } = await source.getBytes(2, 10);

    expect([...new Uint8Array(data)]).toEqual([3]);
  });

  it('throws for anything but ArrayBuffer / Uint8Array', () => {
    [undefined, null, 'abc', [1, 2], new Uint16Array(2), new DataView(new ArrayBuffer(2))].forEach((data) => {
      expect(() => new InMemoryPMTilesSource('k', data)).toThrow(/ArrayBuffer or Uint8Array/);
    });
  });

  // e.g. a slice of a larger download
  it('respects the byteOffset of a Uint8Array view', async () => {
    const view = bytes(0, 0, 10, 11, 12).subarray(2);
    const source = new InMemoryPMTilesSource('k', view);

    const { data } = await source.getBytes(0, 2);

    expect([...new Uint8Array(data)]).toEqual([10, 11]);
  });

  it('a range never reaches past the end of a view into a larger buffer', async () => {
    const view = bytes(1, 2, 3, 4, 5).subarray(1, 3);
    const source = new InMemoryPMTilesSource('k', view);

    const { data } = await source.getBytes(1, 10);

    expect([...new Uint8Array(data)]).toEqual([3]);
  });
});
