import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { errorToast } from '@/store/ui/errorToast';
import { i18nStub } from '@/test/i18nStub';
import CustomPointsDialog from '@/components/CustomPoints/CustomPointsDialog.svelte';

vi.mock('@/store/ui/errorToast', () => ({ errorToast: { error: vi.fn() } }));

let target;
let component;

function render(props) {
  component = mount(CustomPointsDialog, { target, props: { i18n: i18nStub, openedDialog: true, ...props } });
  flushSync();
}

const confirmButton = () =>
  [...document.body.querySelectorAll('button')].find(
    (button) => button.textContent.trim() === 'ui:map:userCustomPoints:dialogButton',
  );

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  errorToast.error.mockClear();
  target = document.createElement('div');
  document.body.append(target);
});

afterEach(() => {
  if (component) unmount(component);
  component = null;
  target.remove();
});

describe('CustomPointsDialog', () => {
  it('explains how custom points work', () => {
    render({ onConfirm: vi.fn() });

    expect(document.body.textContent).toContain('ui:map:userCustomPoints:message');
    expect(document.body.textContent).toContain('ui:map:userCustomPoints:instruction');
  });

  it('the button confirms', async () => {
    const onConfirm = vi.fn(async () => {});
    render({ onConfirm });

    confirmButton().click();
    await settle();

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(errorToast.error).not.toHaveBeenCalled();
  });

  it('a failed confirm tells the user', async () => {
    render({ onConfirm: vi.fn(async () => Promise.reject(new Error('storage down'))) });

    confirmButton().click();
    await settle();

    expect(errorToast.error).toHaveBeenCalledTimes(1);
  });

  it('the failure message is translated', async () => {
    render({ onConfirm: vi.fn(async () => Promise.reject(new Error('storage down'))) });

    confirmButton().click();
    await settle();

    expect(errorToast.error.mock.lastCall[0]).toBe('errors:settingsSaveFailed');
  });
});
