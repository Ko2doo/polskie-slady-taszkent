import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadTextFile } from '@/utils/downloadTextFile';

let clicked;

beforeEach(() => {
  vi.useFakeTimers();
  clicked = [];
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:points'), revokeObjectURL: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() {
    clicked.push({ href: this.href, download: this.download });
  });
});

afterEach(() => vi.useRealTimers());

describe('downloadTextFile', () => {
  it('downloads the text under the given name', async () => {
    downloadTextFile('points.json', '{"a":1}', 'application/json');

    expect(clicked).toEqual([{ href: 'blob:points', download: 'points.json' }]);
    const [blob] = URL.createObjectURL.mock.lastCall;
    expect(blob.type).toBe('application/json');
    expect(await blob.text()).toBe('{"a":1}');
  });

  it('releases the blob url after the click, not before', () => {
    downloadTextFile('points.json', 'x');
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:points');
  });
});
