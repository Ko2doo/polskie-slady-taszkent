import { describe, it, expect } from 'vitest';
import { crc32Hex } from '@/utils/crc32';

describe('crc32Hex', () => {
  it('matches the standard IEEE CRC-32 check value', () => {
    // The canonical check value for CRC-32/ISO-HDLC (zip, png).
    expect(crc32Hex('123456789')).toBe('cbf43926');
  });

  it('returns 8 zero-padded lowercase hex digits', () => {
    expect(crc32Hex('')).toBe('00000000');
    expect(crc32Hex('a')).toBe('e8b7be43');
    expect(crc32Hex('The quick brown fox jumps over the lazy dog')).toMatch(/^[0-9a-f]{8}$/);
  });

  it('checksums the UTF-8 bytes, not UTF-16 code units', () => {
    // 'ż' is U+017C: one UTF-16 code unit, two UTF-8 bytes (c5 bc). The expected value is the
    // CRC-32 of those two bytes (cross-checked with Node's zlib.crc32).
    expect(crc32Hex('ż')).toBe('3583ce53');
  });

  it('changes when a single character changes (corruption detection)', () => {
    const json = '{"schemaVersion":1,"points":[]}';
    expect(crc32Hex(json)).not.toBe(crc32Hex(json.replace('1', '2')));
  });
});
