import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Preferences } from '@capacitor/preferences';
import { getStorage } from '@/capacitor/utils/appStorage';

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

// The real Preferences web implementation (localStorage). The filter restores the saved value
// when the module is imported, so every test imports a fresh copy after preparing the storage.
const STORAGE_KEY = 'map.markerFilter';

async function load() {
  vi.resetModules();
  return import('@/lib/state/mapMarkerFilter.svelte.js');
}

// The restore runs in the background: give it time to finish
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

// Read the way the app reads it, so the test does not depend on the raw storage format
const saved = () => getStorage(STORAGE_KEY);

beforeEach(async () => {
  await Preferences.clear();
  Preferences.get.mockClear();
  Preferences.set.mockClear();
});

describe('mapMarkerFilter', () => {
  it('shows all markers by default', async () => {
    const { mapMarkerFilter, MARKER_FILTER } = await load();
    await settle();

    expect(mapMarkerFilter.selected).toBe(MARKER_FILTER.ALL);
  });

  it('restores the saved filter', async () => {
    await Preferences.set({ key: STORAGE_KEY, value: 'custom' });

    const { mapMarkerFilter } = await load();
    await settle();

    expect(mapMarkerFilter.selected).toBe('custom');
  });

  it('ignores an unknown saved value', async () => {
    await Preferences.set({ key: STORAGE_KEY, value: 'satellite' });

    const { mapMarkerFilter } = await load();
    await settle();

    expect(mapMarkerFilter.selected).toBe('all');
  });

  it('select changes the filter and saves it', async () => {
    const { mapMarkerFilter, MARKER_FILTER } = await load();
    await settle();

    mapMarkerFilter.select(MARKER_FILTER.HISTORICAL);
    await settle();

    expect(mapMarkerFilter.selected).toBe('historical');
    expect(await saved()).toBe('historical');
  });

  it('ignores an unknown filter id', async () => {
    const { mapMarkerFilter } = await load();
    await settle();

    mapMarkerFilter.select('satellite');
    await settle();

    expect(mapMarkerFilter.selected).toBe('all');
    expect(await saved()).toBeNull();
  });

  it('selecting the current filter again does not write', async () => {
    const { mapMarkerFilter } = await load();
    await settle();
    Preferences.set.mockClear();

    mapMarkerFilter.select('all');

    expect(Preferences.set).not.toHaveBeenCalled();
  });

  // On a device the read is a bridge round-trip: the slow read is simulated with a promise the test resolves
  it('a filter picked before the restore finished is kept', async () => {
    let finishRead;
    Preferences.get.mockReturnValueOnce(
      new Promise((resolve) => {
        finishRead = () => resolve({ value: 'historical' });
      }),
    );

    const { mapMarkerFilter } = await load();
    mapMarkerFilter.select('custom');
    finishRead();
    await settle();

    expect(mapMarkerFilter.selected).toBe('custom');
    expect(await saved()).toBe('custom');
  });

  // Re-picking the current filter saves nothing, so the saved one must still be restored
  it('re-picking the current filter before the restore does not block it', async () => {
    let finishRead;
    Preferences.get.mockReturnValueOnce(
      new Promise((resolve) => {
        finishRead = () => resolve({ value: 'historical' });
      }),
    );

    const { mapMarkerFilter } = await load();
    mapMarkerFilter.select('all');
    finishRead();
    await settle();

    expect(mapMarkerFilter.selected).toBe('historical');
  });
});
