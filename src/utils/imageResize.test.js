import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downscaleImage } from '@/utils/imageResize';

// jsdom has neither createImageBitmap nor a real canvas: both are replaced with recorders, so the
// tests assert on what was drawn and encoded, not on pixels.
let calls;
let encodedBlob;

function stubBitmap(width, height) {
  const bitmap = { width, height, close: vi.fn() };
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => bitmap),
  );
  return bitmap;
}

beforeEach(() => {
  calls = [];
  encodedBlob = new Blob(['jpeg'], { type: 'image/jpeg' });

  const context = {
    set fillStyle(value) {
      calls.push(['fillStyle', value]);
    },
    fillRect: (...args) => calls.push(['fillRect', ...args]),
    drawImage: (_bitmap, ...args) => calls.push(['drawImage', ...args]),
  };

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (callback, type, quality) {
    calls.push(['toBlob', this.width, this.height, type, quality]);
    callback(encodedBlob);
  });
});

describe('downscaleImage', () => {
  it('scales the long side of a landscape image down to maxSide', async () => {
    stubBitmap(4000, 3000);

    const result = await downscaleImage(new Blob(), { maxSide: 1280, quality: 80 });

    expect(result).toBe(encodedBlob);
    expect(calls).toContainEqual(['drawImage', 0, 0, 1280, 960]);
    expect(calls).toContainEqual(['toBlob', 1280, 960, 'image/jpeg', 0.8]);
  });

  it('scales a portrait image by its height', async () => {
    stubBitmap(3000, 4000);

    await downscaleImage(new Blob(), { maxSide: 1280, quality: 80 });

    expect(calls).toContainEqual(['drawImage', 0, 0, 960, 1280]);
  });

  it('never enlarges a smaller image', async () => {
    stubBitmap(800, 600);

    await downscaleImage(new Blob(), { maxSide: 1280, quality: 80 });

    expect(calls).toContainEqual(['drawImage', 0, 0, 800, 600]);
  });

  it('keeps an image exactly at the limit as is', async () => {
    stubBitmap(1280, 720);

    await downscaleImage(new Blob(), { maxSide: 1280, quality: 80 });

    expect(calls).toContainEqual(['drawImage', 0, 0, 1280, 720]);
  });

  it('never produces a zero-sized side for an extreme aspect ratio', async () => {
    stubBitmap(10000, 2);

    await downscaleImage(new Blob(), { maxSide: 1000, quality: 80 });

    expect(calls).toContainEqual(['drawImage', 0, 0, 1000, 1]);
  });

  it('paints a white background before drawing (JPEG has no transparency)', async () => {
    stubBitmap(100, 50);

    await downscaleImage(new Blob(), { maxSide: 1280, quality: 80 });

    const names = calls.map(([name]) => name);
    expect(names.slice(0, 3)).toEqual(['fillStyle', 'fillRect', 'drawImage']);
    expect(calls[0]).toEqual(['fillStyle', '#ffffff']);
    expect(calls[1]).toEqual(['fillRect', 0, 0, 100, 50]);
  });

  it('decodes with EXIF orientation applied', async () => {
    stubBitmap(10, 10);
    const blob = new Blob();

    await downscaleImage(blob, { maxSide: 1280, quality: 80 });

    expect(createImageBitmap).toHaveBeenCalledWith(blob, { imageOrientation: 'from-image' });
  });

  it('retries decoding without options on a browser that rejects them', async () => {
    const bitmap = { width: 10, height: 10, close: vi.fn() };
    const decode = vi.fn(async (_blob, options) => {
      if (options) throw new TypeError('unknown option');
      return bitmap;
    });
    vi.stubGlobal('createImageBitmap', decode);

    await downscaleImage(new Blob(), { maxSide: 1280, quality: 80 });

    expect(decode).toHaveBeenCalledTimes(2);
    expect(decode.mock.calls[1]).toHaveLength(1);
  });

  it('releases the bitmap after encoding', async () => {
    const bitmap = stubBitmap(10, 10);

    await downscaleImage(new Blob(), { maxSide: 1280, quality: 80 });

    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });

  it('rejects and still releases the bitmap when encoding fails', async () => {
    const bitmap = stubBitmap(10, 10);
    HTMLCanvasElement.prototype.toBlob.mockImplementation((callback) => callback(null));

    await expect(downscaleImage(new Blob(), { maxSide: 1280, quality: 80 })).rejects.toThrow(
      'Failed to encode the image',
    );
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });

  it('rejects when the image cannot be decoded at all', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        throw new DOMException('bad image', 'InvalidStateError');
      }),
    );

    await expect(downscaleImage(new Blob(), { maxSide: 1280, quality: 80 })).rejects.toThrow('bad image');
  });

  it('works with a bitmap that has no close()', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 10, height: 10 })),
    );

    await expect(downscaleImage(new Blob(), { maxSide: 1280, quality: 80 })).resolves.toBe(encodedBlob);
  });
});
