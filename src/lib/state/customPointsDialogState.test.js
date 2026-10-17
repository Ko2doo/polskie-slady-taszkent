import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Preferences } from '@capacitor/preferences';
import { customPointsDialogState } from '@/lib/state/customPointsDialogState.svelte.js';

// Every Preferences method is a recorder that calls the real web implementation (localStorage).
// A Capacitor plugin export is a Proxy, so vi.spyOn can not wrap it (see harness/testing.md).
vi.mock('@capacitor/preferences', async (importOriginal) => {
  const actual = await importOriginal();
  const methods = ['get', 'set', 'remove', 'clear'];
  const Preferences = Object.fromEntries(
    methods.map((name) => [name, vi.fn((...args) => actual.Preferences[name](...args))]),
  );

  return { ...actual, Preferences };
});

// The real Preferences web implementation (localStorage)
const DIALOG_KEY = 'app.custom_points_dialog.seen';

beforeEach(async () => {
  await Preferences.clear();
});

describe('customPointsDialogState', () => {
  it('is unknown until loaded', () => {
    expect(customPointsDialogState().seen).toBeNull();
  });

  it('a first-time user has not seen the dialog', async () => {
    const dialog = customPointsDialogState();

    expect(await dialog.hasSeen()).toBe(false);
    expect(dialog.seen).toBe(false);
  });

  it('remembers that the dialog was seen', async () => {
    await customPointsDialogState().markCompleted();

    const later = customPointsDialogState();

    expect(await later.hasSeen()).toBe(true);
    expect((await Preferences.get({ key: DIALOG_KEY })).value).toBe('true');
  });

  // The caller (CustomPointsDialog) shows an error and keeps the dialog open to retry
  it('a failed save throws and does not count as seen', async () => {
    const dialog = customPointsDialogState();
    await dialog.hasSeen();
    Preferences.set.mockRejectedValueOnce(new Error('storage full'));

    await expect(dialog.markCompleted()).rejects.toThrow();

    expect(dialog.seen).toBe(false);
  });

  it('markCompleted updates the state at once', async () => {
    const dialog = customPointsDialogState();
    await dialog.hasSeen();

    await dialog.markCompleted();

    expect(dialog.seen).toBe(true);
  });

  it('only a stored true counts as seen', async () => {
    await Preferences.set({ key: DIALOG_KEY, value: '"true"' });

    expect(await customPointsDialogState().hasSeen()).toBe(false);
  });

  it('reads the storage only once', async () => {
    const dialog = customPointsDialogState();
    await dialog.hasSeen();
    Preferences.get.mockClear();

    await dialog.hasSeen();

    expect(Preferences.get).not.toHaveBeenCalled();
  });

  it('a storage that can not be read counts as not seen', async () => {
    Preferences.get.mockRejectedValueOnce(new Error('storage down'));

    expect(await customPointsDialogState().hasSeen()).toBe(false);
  });

  it('open and close drive the trigger', () => {
    const dialog = customPointsDialogState();

    dialog.open();
    expect(dialog.triggerValue).toBe(true);

    dialog.close();
    expect(dialog.triggerValue).toBe(false);
  });
});
