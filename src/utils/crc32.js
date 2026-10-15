/**
 * CRC32 (IEEE 802.3, the same as in zip and png)
 *
 * NOT a security feature: it detects accidental corruption (a truncated or hand-edited file),
 * it can not detect a deliberately forged one.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);

  for (let n = 0; n < 256; n += 1) {
    let c = n;

    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }

    table[n] = c >>> 0;
  }

  return table;
})();

/**
 * @param {string} text - Text to checksum (its UTF-8 bytes are used)
 * @returns {string} - 8 lowercase hex digits
 */
export function crc32Hex(text) {
  const bytes = new TextEncoder().encode(text);
  let crc = 0xffffffff;

  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }

  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
}
