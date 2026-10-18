import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { get } from 'svelte/store';
import { errorToast } from '@/store/ui/errorToast';
import { i18nStub } from '@/test/i18nStub';
import ErrorHandlerToast from './ErrorHandlerToast.svelte';

let target;
let component;

const button = () => document.body.querySelector('.toast button, button');
const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  flushSync();
};

beforeEach(() => {
  errorToast.clear();
  target = document.createElement('div');
  document.body.append(target);
  component = mount(ErrorHandlerToast, { target, props: { i18n: i18nStub } });
  flushSync();
});

afterEach(() => {
  unmount(component);
  target.remove();
  errorToast.clear();
});

describe('ErrorHandlerToast', () => {
  it('shows the message with its scope and code', () => {
    errorToast.error('Disk full', { scope: 'Storage', code: 'X1' });
    flushSync();

    expect(document.body.textContent).toContain('Disk full');
    expect(document.body.textContent).toContain('ui:toasts:errorScope {"scope":"Storage"}');
    expect(document.body.textContent).toContain('ui:toasts:errorCode {"code":"X1"}');
  });

  it('an error with nothing usable in it shows the translated "unknown error"', () => {
    errorToast.error(new Error(''));
    flushSync();

    expect(document.body.textContent).toContain('errors:unknownError');
  });

  it('a message with text does not show the "unknown error" fallback', () => {
    errorToast.error('Disk full');
    flushSync();

    expect(document.body.textContent).not.toContain('errors:unknownError');
  });

  it('without scope and code: no technical line', () => {
    errorToast.error('Disk full');
    flushSync();

    expect(document.body.textContent).not.toContain('ui:toasts:errorScope');
    expect(document.body.textContent).not.toContain('ui:toasts:errorCode');
  });

  it('the close button hides it and shows the next one', () => {
    errorToast.error('First');
    errorToast.error('Second');
    flushSync();

    expect(button().textContent.trim()).toBe('errors:toastBtn');
    button().click();
    flushSync();

    expect(get(errorToast).content).toBe('Second');
  });

  it('an action button runs its handler, then hides the toast', async () => {
    const handler = vi.fn(async () => {});
    errorToast.error('Denied', { action: { label: 'Open settings', handler } });
    flushSync();

    expect(button().textContent.trim()).toBe('Open settings');
    button().click();
    await settle();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(get(errorToast).opened).toBe(false);
  });

  it('a failing action keeps the toast open', async () => {
    errorToast.error('Denied', {
      action: { label: 'Open settings', handler: async () => Promise.reject(new Error('x')) },
    });
    flushSync();

    button().click();
    await settle();

    expect(get(errorToast).opened).toBe(true);
  });
});
