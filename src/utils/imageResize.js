/**
 * downscaleImage helper (web only)
 *
 * On a device the Camera plugin resizes and compresses a photo natively (targetWidth / targetHeight / quality).
 * The web implementation of the plugin ignores these options, so the browser (development) uses this helper
 * to get the same result: a JPEG with the long side of at most `maxSide` pixels.
 * A side effect that is wanted: re-encoding drops the EXIF data (including the GPS position) of the photo.
 */

async function decode(blob) {
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    // Old browsers do not know this option (the orientation is applied by default there)
    return createImageBitmap(blob);
  }
}

function toJpegBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode the image'))),
      'image/jpeg',
      quality,
    );
  });
}

/**
 * @param {Blob} blob - Image of any format the browser can decode
 * @param {Object} options
 * @param {number} options.maxSide - Max size of the long side in pixels (a smaller image is never enlarged)
 * @param {number} options.quality - JPEG quality, 0..100
 * @returns {Promise<Blob>} - JPEG
 * @throws if the image can not be decoded or encoded
 */
export async function downscaleImage(blob, { maxSide, quality }) {
  const bitmap = await decode(blob);

  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');

    // JPEG has no transparency: a transparent PNG would turn black without a background
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);

    return await toJpegBlob(canvas, quality / 100);
  } finally {
    if (typeof bitmap.close === 'function') bitmap.close();
  }
}
