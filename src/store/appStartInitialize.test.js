import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { Preferences } from '@capacitor/preferences';

// Every Preferences method is a recorder that calls the real web implementation (localStorage).
vi.mock('@capacitor/preferences', async (importOriginal) => {
  const actual = await importOriginal();
  const methods = ['get', 'set', 'remove', 'clear'];
  const Preferences = Object.fromEntries(
    methods.map((name) => [name, vi.fn((...args) => actual.Preferences[name](...args))]),
  );

  return { ...actual, Preferences };
});

const KEY = 'app.onboarding.completed';

// The store is module-level: every test imports a fresh copy
let firstLaunch;

beforeEach(async () => {
  await Preferences.clear();
  vi.resetModules();
  firstLaunch = await import('@/store/appStartInitialize');
});

const showWizard = () => get(firstLaunch.APP_FIRST_LAUNCH_STORAGE_VAL);

describe('initFirstLaunch', () => {
  it('is unknown until initialized', () => {
    expect(showWizard()).toBeNull();
  });

  it('shows the onboarding on the first launch', async () => {
    await firstLaunch.initFirstLaunch();

    expect(showWizard()).toBe(true);
  });

  it('shows it again when it was stored as not completed', async () => {
    await Preferences.set({ key: KEY, value: 'false' });

    await firstLaunch.initFirstLaunch();

    expect(showWizard()).toBe(true);
  });

  it('hides it once completed', async () => {
    await Preferences.set({ key: KEY, value: 'true' });

    await firstLaunch.initFirstLaunch();

    expect(showWizard()).toBe(false);
  });

  it('a storage that can not be read shows the onboarding', async () => {
    Preferences.get.mockRejectedValueOnce(new Error('storage down'));

    await firstLaunch.initFirstLaunch();

    expect(showWizard()).toBe(true);
  });
});

// BUG-1: a stored value other than true/false/null (e.g. written by another version) leaves the
// state null, so the onboarding is never shown (see BUGS.md). Remove `.fails` once fixed.
describe('an unexpected stored value', () => {
  it.fails('shows the onboarding', async () => {
    await Preferences.set({ key: KEY, value: '"yes"' });

    await firstLaunch.initFirstLaunch();

    expect(showWizard()).toBe(true);
  });
});

describe('markFirstLaunchCompleted', () => {
  it('hides the onboarding and remembers it for the next launch', async () => {
    await firstLaunch.initFirstLaunch();

    await firstLaunch.markFirstLaunchCompleted();
    expect(showWizard()).toBe(false);

    vi.resetModules();
    const nextLaunch = await import('@/store/appStartInitialize');
    await nextLaunch.initFirstLaunch();

    expect(get(nextLaunch.APP_FIRST_LAUNCH_STORAGE_VAL)).toBe(false);
  });

  // The wizard shows an error and stays open so the user can try again
  it('a failed save throws and keeps the onboarding shown', async () => {
    await firstLaunch.initFirstLaunch();
    Preferences.set.mockRejectedValueOnce(new Error('storage full'));

    await expect(firstLaunch.markFirstLaunchCompleted()).rejects.toThrow();

    expect(showWizard()).toBe(true);
  });
});
