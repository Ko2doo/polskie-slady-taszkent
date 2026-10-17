import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { exitToast, toastController } from '@/services/toastController';

beforeEach(() => exitToast.set({ opened: false, durationMs: 3000, version: 0 }));

describe('toastController', () => {
  it('shows the exit toast with the default 3 s countdown', () => {
    toastController.showExitToast();

    expect(get(exitToast)).toEqual({ opened: true, durationMs: 3000, version: 1 });
  });

  // ExitToast restarts its countdown when the version changes, even if it is already open
  it('every show bumps the version and takes the given duration', () => {
    toastController.showExitToast();
    toastController.showExitToast(5000);

    expect(get(exitToast)).toEqual({ opened: true, durationMs: 5000, version: 2 });
  });

  it('hide closes it and keeps the rest', () => {
    toastController.showExitToast(4000);

    toastController.hide();

    expect(get(exitToast)).toEqual({ opened: false, durationMs: 4000, version: 1 });
  });
});
