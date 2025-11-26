/**
 * InMemoryPmtilesSource
 *
 * A minimal implementation of the pmtiles `Source` interface that
 * keeps the whole .pmtiles archive in memory (ArrayBuffer) and
 * serves byte ranges from it.
 *
 * This lets pmtiles work without HTTP Range support: we fetch the
 * file once, store it in RAM, and answer all tile requests from
 * that in-memory buffer.
 */

export class InMemoryPMTilesSource {
  /**
   * @param {string} key
   *   Unique identifier for this archive. Must match the string
   *   used in the style URL, e.g. "pmtiles://tashkent-local".
   *
   * @param {ArrayBuffer | Uint8Array} data
   *   Raw contents of the .pmtiles file.
   */
  constructor(key, data) {
    this._key = key;

    // Internally we always keep an ArrayBuffer
    if (data instanceof ArrayBuffer) {
      this._data = data;
    } else if (data instanceof Uint8Array) {
      this._data = data.buffer;
    } else {
      throw new Error('InMemoryPmtilesSource: data must be ArrayBuffer or Uint8Array');
    }
  }

  /**
   * Called by pmtiles to identify this source.
   * The returned key must match the part after "pmtiles://"
   * in your style JSON ("pmtiles://tashkent-local").
   */
  getKey() {
    return this._key;
  }

  /**
   * Called by pmtiles every time it needs a byte range from the archive.
   *
   * @param {number} offset
   *   Start position (in bytes) inside the .pmtiles file.
   * @param {number} length
   *   Number of bytes to read.
   *
   * @returns {Promise<{ data: ArrayBuffer }>}
   *   An object containing the requested byte range as an ArrayBuffer.
   */
  async getBytes(offset, lenght) {
    const slice = this._data.slice(offset, offset + lenght);

    return {
      data: slice,
    };
  }
}
