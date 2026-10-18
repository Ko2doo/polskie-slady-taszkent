import { describe, it, expect, vi, afterEach } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { i18nStub } from '@/test/i18nStub';
import CustomPointsImportDialog from './CustomPointsImportDialog.svelte';

let target;
let component;

function render(preview, handlers = {}) {
  target = document.createElement('div');
  document.body.append(target);
  component = mount(CustomPointsImportDialog, {
    target,
    props: { i18n: i18nStub, opened: true, preview, onConfirm: vi.fn(), onCancel: vi.fn(), ...handlers },
  });
  flushSync();
}

const text = () => target.textContent;
const KEY = 'ui:settings:customPoints:importDialog';

afterEach(() => {
  unmount(component);
  target.remove();
});

describe('CustomPointsImportDialog', () => {
  it('shows what would be added and updated, with the photos note', () => {
    render({ added: 3, updated: 2, unchanged: 0, skipped: 0 });

    expect(text()).toContain(`${KEY}:willAdd {"count":3}`);
    expect(text()).toContain(`${KEY}:willUpdate {"count":2}`);
    expect(text()).toContain(`${KEY}:photosKept`);
    expect(text()).not.toContain(`${KEY}:unchanged`);
    expect(text()).not.toContain('importSkipped');
  });

  it('only new points: no "updated" line and no photos note', () => {
    render({ added: 3, updated: 0, unchanged: 0, skipped: 0 });

    expect(text()).not.toContain(`${KEY}:willUpdate`);
    expect(text()).not.toContain(`${KEY}:photosKept`);
  });

  it('only updates: no "added" line', () => {
    render({ added: 0, updated: 1, unchanged: 0, skipped: 0 });

    expect(text()).not.toContain(`${KEY}:willAdd`);
    expect(text()).toContain(`${KEY}:willUpdate {"count":1}`);
  });

  it('mentions unchanged points and skipped broken entries', () => {
    render({ added: 1, updated: 0, unchanged: 4, skipped: 2 });

    expect(text()).toContain(`${KEY}:unchanged {"count":4}`);
    expect(text()).toContain('ui:settings:customPoints:importSkipped {"skipped":2}');
  });

  it('without a preview: no counts', () => {
    render(null);

    expect(text()).not.toContain(`${KEY}:will`);
  });

  it('the buttons confirm and cancel', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render({ added: 1, updated: 0, unchanged: 0, skipped: 0 }, { onConfirm, onCancel });
    const buttons = [...target.querySelectorAll('button')];

    buttons.find((item) => item.textContent.trim() === `${KEY}:confirm`).click();
    buttons.find((item) => item.textContent.trim() === `${KEY}:cancel`).click();

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
