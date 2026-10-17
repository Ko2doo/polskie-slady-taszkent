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

// The store restores the saved layout when the module is imported: every test imports a fresh copy
const STORAGE_KEY = 'handbook.layoutMode';

async function load() {
  vi.resetModules();
  return (await import('@/store/ui/layoutView')).layoutView;
}

// The restore runs in the background: give it time to finish
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

// Read the way the app reads it, so the test does not depend on the raw storage format
const saved = () => getStorage(STORAGE_KEY);

function read(store) {
  let value;
  store.subscribe((next) => (value = next))();
  return value;
}

beforeEach(async () => {
  await Preferences.clear();
  Preferences.get.mockClear();
  Preferences.set.mockClear();
});

describe('layoutView', () => {
  it('is a grid by default, synchronously', async () => {
    const layoutView = await load();

    expect(read(layoutView).mode).toBe('layoutGrid');
    expect(read(layoutView).classes).toContain('grid-cols-2');
  });

  it('restores saved rows and notifies subscribers', async () => {
    await Preferences.set({ key: STORAGE_KEY, value: 'layoutRows' });
    const layoutView = await load();
    const seen = [];
    layoutView.subscribe((value) => seen.push(value.mode));

    await settle();

    expect(seen.at(-1)).toBe('layoutRows');
  });

  it('an unknown saved value means grid', async () => {
    await Preferences.set({ key: STORAGE_KEY, value: 'masonry' });
    const layoutView = await load();
    await settle();

    expect(read(layoutView).mode).toBe('layoutGrid');
  });

  it('set switches, saves and notifies', async () => {
    const layoutView = await load();
    await settle();
    const subscriber = vi.fn();
    layoutView.subscribe(subscriber);

    layoutView.set('layoutRows');
    await settle();

    expect(subscriber).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'layoutRows' }));
    expect(await saved()).toBe('layoutRows');
  });

  it('anything but rows means grid', async () => {
    const layoutView = await load();
    await settle();
    layoutView.set('layoutRows');

    layoutView.set('whatever');

    expect(read(layoutView).mode).toBe('layoutGrid');
  });

  it('setting the current layout does nothing', async () => {
    const layoutView = await load();
    await settle();
    const subscriber = vi.fn();
    layoutView.subscribe(subscriber);
    subscriber.mockClear();
    Preferences.set.mockClear();

    layoutView.set('layoutGrid');

    expect(subscriber).not.toHaveBeenCalled();
    expect(Preferences.set).not.toHaveBeenCalled();
  });

  it('an unsubscribed listener is not notified', async () => {
    const layoutView = await load();
    await settle();
    const subscriber = vi.fn();
    const unsubscribe = layoutView.subscribe(subscriber);
    subscriber.mockClear();

    unsubscribe();
    layoutView.set('layoutRows');

    expect(subscriber).not.toHaveBeenCalled();
  });

  // Even with nothing saved, the restore used to reset the pick to grid
  it('a layout picked before the restore finished is kept', async () => {
    let finishRead;
    Preferences.get.mockReturnValueOnce(
      new Promise((resolve) => {
        finishRead = () => resolve({ value: null });
      }),
    );

    const layoutView = await load();
    layoutView.set('layoutRows');
    finishRead();
    await settle();

    expect(read(layoutView).mode).toBe('layoutRows');
  });

  it('re-picking the current layout before the restore does not block it', async () => {
    let finishRead;
    Preferences.get.mockReturnValueOnce(
      new Promise((resolve) => {
        finishRead = () => resolve({ value: 'layoutRows' });
      }),
    );

    const layoutView = await load();
    layoutView.set('layoutGrid');
    finishRead();
    await settle();

    expect(read(layoutView).mode).toBe('layoutRows');
  });
});
