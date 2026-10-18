import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shareFile } from './share';

const deps = vi.hoisted(() => ({}));

vi.mock('@capacitor/share', () => ({
  Share: { share: (...args) => deps.share(...args) },
}));

const OPTIONS = { uri: 'file:///cache/exports/points.json', title: 'Points', dialogTitle: 'Share points' };

beforeEach(() => {
  deps.share = vi.fn(async () => ({ activityType: 'com.google.android.apps.docs' }));
});

describe('shareFile', () => {
  it('shares the file with its titles', async () => {
    expect(await shareFile(OPTIONS)).toBe('shared');
    expect(deps.share).toHaveBeenCalledWith({
      title: 'Points',
      dialogTitle: 'Share points',
      files: ['file:///cache/exports/points.json'],
    });
  });

  it('a sheet closed without a choice is "cancelled", not an error', async () => {
    deps.share.mockRejectedValueOnce(new Error('Share canceled'));

    expect(await shareFile(OPTIONS)).toBe('cancelled');
  });

  it('any other failure is thrown', async () => {
    deps.share.mockRejectedValueOnce(new Error("Can't share while sharing is in progress"));

    await expect(shareFile(OPTIONS)).rejects.toThrow('sharing is in progress');
  });
});
