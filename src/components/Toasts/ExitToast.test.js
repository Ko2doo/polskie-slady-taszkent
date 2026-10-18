import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { get } from 'svelte/store';
import { exitToast, toastController } from '@/services/toastController';
import { i18nStub } from '@/test/i18nStub';
import ExitToast from './ExitToast.svelte';

let target;
let component;

const countdown = () => document.body.querySelector('.tabular-nums').textContent.trim();
const tick = (ms) => {
  vi.advanceTimersByTime(ms);
  flushSync();
};

beforeEach(() => {
  vi.useFakeTimers();
  exitToast.set({ opened: false, durationMs: 3000, version: 0 });
  target = document.createElement('div');
  document.body.append(target);
  component = mount(ExitToast, { target, props: { i18n: i18nStub } });
  flushSync();
});

afterEach(() => {
  if (component) unmount(component);
  component = null;
  target.remove();
  vi.useRealTimers();
});

describe('ExitToast', () => {
  it('counts down the exit window in whole seconds', () => {
    toastController.showExitToast(3000);
    flushSync();
    expect(countdown()).toBe('3s');
    expect(document.body.textContent).toContain('ui:toasts:exitApp');

    tick(1000);
    expect(countdown()).toBe('2s');
  });

  it('hides itself when the window is over', () => {
    toastController.showExitToast(3000);
    flushSync();

    tick(3000);

    expect(get(exitToast).opened).toBe(false);
  });

  it('a tap restarts the countdown', () => {
    toastController.showExitToast(3000);
    flushSync();
    tick(2000);

    document.body.querySelector('.toast, [class*="toast"]').click();
    flushSync();

    expect(countdown()).toBe('3s');
    tick(2000);
    expect(get(exitToast).opened).toBe(true);
  });

  it('another back press (a new show) restarts it too', () => {
    toastController.showExitToast(3000);
    flushSync();
    tick(2500);

    toastController.showExitToast(3000);
    flushSync();

    expect(countdown()).toBe('3s');
  });

  it('stops its timer when it goes away', () => {
    toastController.showExitToast(3000);
    flushSync();

    unmount(component);
    component = null;

    expect(vi.getTimerCount()).toBe(0);
  });
});
