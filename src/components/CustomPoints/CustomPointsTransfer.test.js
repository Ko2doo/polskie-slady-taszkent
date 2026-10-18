import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { ERROR_CODES } from '@/lib/errors/errorCodes';
import { errorToast } from '@/store/ui/errorToast';
import { get } from 'svelte/store';
import { overlayController, overlayState } from '@/store/ui/overlayController';
import { i18nStub } from '@/test/i18nStub';
import CustomPointsTransfer from './CustomPointsTransfer.svelte';

const deps = vi.hoisted(() => ({}));

vi.mock('@/lib/state/customPointsState.svelte.js', () => ({
  customPointsState: {
    exportFile: (...args) => deps.exportFile(...args),
    previewImport: (...args) => deps.previewImport(...args),
    importFile: (...args) => deps.importFile(...args),
  },
}));
vi.mock('@/services/customPointsTransfer', () => ({
  EXPORT_MIME_TYPE: 'application/json',
  deliverExportFile: (...args) => deps.deliverExportFile(...args),
  readImportFile: (...args) => deps.readImportFile(...args),
}));
vi.mock('@/store/ui/errorToast', () => ({ errorToast: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

let target;
let component;

const button = (key) =>
  [...target.querySelectorAll('button')].find((item) => item.textContent.trim() === `ui:settings:customPoints:${key}`);
const fileInput = () => target.querySelector('input[type="file"]');
const dialogButton = (key) =>
  [...document.body.querySelectorAll('button')].find(
    (item) => item.textContent.trim() === `ui:settings:customPoints:importDialog:${key}`,
  );
const statusText = () => target.querySelector('[role="status"]').textContent.trim();
// Every step yields a macrotask before its work (so the spinner can paint): let a few pass
const settle = async () => {
  for (let turn = 0; turn < 3; turn += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    flushSync();
  }
};

// The user picking a file in the system chooser
async function pick(file) {
  const input = fileInput();
  Object.defineProperty(input, 'files', { value: file ? [file] : [], configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await settle();
}

beforeEach(() => {
  deps.exportFile = vi.fn(async () => ({ text: '{"points":[1]}', count: 1 }));
  deps.deliverExportFile = vi.fn(async () => 'shared');
  deps.readImportFile = vi.fn(async () => ({ ok: true, text: 'file text' }));
  deps.previewImport = vi.fn(async () => ({ ok: true, added: 2, updated: 1, unchanged: 3, skipped: 0 }));
  deps.importFile = vi.fn(async () => ({ ok: true, added: 2, updated: 1, unchanged: 3, skipped: 0 }));
  Object.values(errorToast).forEach((fn) => fn.mockReset());

  target = document.createElement('div');
  document.body.append(target);
  component = mount(CustomPointsTransfer, { target, props: { i18n: i18nStub } });
  flushSync();
});

afterEach(() => {
  unmount(component);
  target.remove();
});

describe('CustomPointsTransfer', () => {
  it('shows its title, hint and both buttons', () => {
    expect(target.textContent).toContain('ui:settings:customPoints:title');
    expect(target.textContent).toContain('ui:settings:customPoints:hint');
    expect(button('export')).toBeTruthy();
    expect(button('import')).toBeTruthy();
  });

  describe('export', () => {
    it('hands the export file over with translated titles', async () => {
      button('export').click();
      await settle();

      expect(deps.deliverExportFile).toHaveBeenCalledWith('{"points":[1]}', {
        title: 'ui:settings:customPoints:shareTitle',
        dialogTitle: 'ui:settings:customPoints:shareDialogTitle',
      });
      expect(errorToast.error).not.toHaveBeenCalled();
    });

    it('with no markers: says so, opens nothing', async () => {
      deps.exportFile.mockResolvedValueOnce({ text: '{}', count: 0 });

      button('export').click();
      await settle();

      expect(deps.deliverExportFile).not.toHaveBeenCalled();
      expect(errorToast.info).toHaveBeenCalledWith('ui:settings:customPoints:nothingToExport', expect.anything());
    });

    it('a closed share sheet is not an error', async () => {
      deps.deliverExportFile.mockResolvedValueOnce('cancelled');

      button('export').click();
      await settle();

      expect(errorToast.error).not.toHaveBeenCalled();
      expect(errorToast.info).not.toHaveBeenCalled();
    });

    it('a failure: tells the user, the buttons work again', async () => {
      deps.deliverExportFile.mockRejectedValueOnce(new Error('no space'));

      button('export').click();
      await settle();

      expect(errorToast.error).toHaveBeenCalledWith('errors:customPointsExportFailed', {
        scope: 'CustomPointsTransfer',
        code: ERROR_CODES.POINTS_EXPORT_FAILED,
      });
      expect(button('export').disabled).toBe(false);
    });

    it('both buttons are disabled while the export runs', async () => {
      let finish;
      deps.deliverExportFile.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));

      button('export').click();
      await settle();
      expect(button('export').disabled).toBe(true);
      expect(button('import').disabled).toBe(true);

      finish('shared');
      await settle();
      expect(button('export').disabled).toBe(false);
    });
  });

  describe('progress', () => {
    it('says which step runs, and nothing when idle', async () => {
      let finish;
      deps.deliverExportFile.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
      expect(statusText()).toBe('');

      button('export').click();
      await settle();
      expect(statusText()).toBe('ui:settings:customPoints:progress:exporting');
      expect(button('export').disabled).toBe(true);
      expect(button('import').disabled).toBe(true);

      finish('shared');
      await settle();
      expect(statusText()).toBe('');
      expect(button('export').disabled).toBe(false);
    });

    it('checking a picked file shows its own step', async () => {
      let finish;
      deps.previewImport.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));

      await pick(new File(['x'], 'points.json'));
      expect(statusText()).toBe('ui:settings:customPoints:progress:checking');

      finish({ ok: true, added: 1, updated: 0, unchanged: 0, skipped: 0 });
      await settle();
      expect(statusText()).toBe('');
    });

    it('the import itself shows its own step', async () => {
      let finish;
      deps.importFile.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
      await pick(new File(['x'], 'points.json'));

      dialogButton('confirm').click();
      await settle();
      expect(statusText()).toBe('ui:settings:customPoints:progress:importing');

      finish({ ok: true, added: 2, updated: 1, unchanged: 3, skipped: 0 });
      await settle();
      expect(statusText()).toBe('');
    });
  });

  describe('import', () => {
    it('the import button opens the file chooser', () => {
      const click = vi.spyOn(fileInput(), 'click').mockImplementation(() => {});

      button('import').click();

      expect(click).toHaveBeenCalledTimes(1);
    });

    it('the chooser offers JSON files', () => {
      expect(fileInput().accept).toBe('application/json,.json');
    });

    it('checks the picked file first and asks, showing what would be added and updated', async () => {
      const file = new File(['x'], 'points.json');

      await pick(file);

      expect(deps.readImportFile).toHaveBeenCalledWith(file);
      expect(deps.previewImport).toHaveBeenCalledWith('file text');
      expect(deps.importFile).not.toHaveBeenCalled();
      expect(document.body.textContent).toContain('ui:settings:customPoints:importDialog:willAdd {"count":2}');
      expect(document.body.textContent).toContain('ui:settings:customPoints:importDialog:willUpdate {"count":1}');
      expect(get(overlayState).stack).toHaveLength(1);
    });

    it('confirming imports the checked file and shows the summary', async () => {
      await pick(new File(['x'], 'points.json'));

      dialogButton('confirm').click();
      await settle();

      expect(deps.importFile).toHaveBeenCalledWith('file text');
      expect(errorToast.info).toHaveBeenCalledWith(
        'ui:settings:customPoints:importDone {"added":2,"updated":1,"unchanged":3}',
        { scope: 'CustomPointsTransfer' },
      );
    });

    it('cancelling imports nothing', async () => {
      await pick(new File(['x'], 'points.json'));

      dialogButton('cancel').click();
      await settle();

      expect(deps.importFile).not.toHaveBeenCalled();
      expect(errorToast.info).not.toHaveBeenCalled();
    });

    it('Android back closes the dialog and imports nothing, the file is let go', async () => {
      await pick(new File(['x'], 'points.json'));

      expect(overlayController.tryClose()).toBe(true);
      await settle();
      dialogButton('confirm').click();
      await settle();

      expect(deps.importFile).not.toHaveBeenCalled();
    });

    it('leaving Settings with the dialog open leaves nothing on the back-button stack', async () => {
      await pick(new File(['x'], 'points.json'));

      unmount(component);
      component = mount(CustomPointsTransfer, { target, props: { i18n: i18nStub } });

      expect(overlayController.tryClose()).toBe(false);
    });

    it('a file with nothing new: says so, no dialog', async () => {
      deps.previewImport.mockResolvedValueOnce({ ok: true, added: 0, updated: 0, unchanged: 4, skipped: 0 });

      await pick(new File(['x'], 'points.json'));

      expect(errorToast.info).toHaveBeenCalledWith('ui:settings:customPoints:nothingNew', expect.anything());
      expect(overlayController.tryClose()).toBe(false);
    });

    it('mentions skipped broken entries in the summary', async () => {
      deps.importFile.mockResolvedValueOnce({ ok: true, added: 1, updated: 0, unchanged: 0, skipped: 2 });
      await pick(new File(['x'], 'points.json'));

      dialogButton('confirm').click();
      await settle();

      expect(errorToast.info.mock.lastCall[0]).toContain('ui:settings:customPoints:importSkipped {"skipped":2}');
    });

    it('a closed chooser says nothing', async () => {
      deps.readImportFile.mockResolvedValueOnce({ ok: false, reason: 'noFile' });

      await pick(null);

      expect(deps.previewImport).not.toHaveBeenCalled();
      expect(errorToast.error).not.toHaveBeenCalled();
    });

    it.each([
      ['tooLarge', 'errors:customPointsImportTooLarge'],
      ['unreadable', 'errors:customPointsImportUnreadable'],
    ])('a file that can not be read (%s) is refused with its reason', async (reason, text) => {
      deps.readImportFile.mockResolvedValueOnce({ ok: false, reason });

      await pick(new File(['x'], 'points.json'));

      expect(deps.previewImport).not.toHaveBeenCalled();
      expect(errorToast.error).toHaveBeenCalledWith(expect.stringContaining(text), {
        scope: 'CustomPointsTransfer',
        code: ERROR_CODES.POINTS_IMPORT_REFUSED,
      });
    });

    it.each([
      ['invalidJson', 'errors:customPointsImportNotPoints'],
      ['unknownFormat', 'errors:customPointsImportNotPoints'],
      ['invalidFile', 'errors:customPointsImportNotPoints'],
      ['checksumMismatch', 'errors:customPointsImportDamaged'],
      ['unsupportedVersion', 'errors:customPointsImportNewerVersion'],
      ['tooManyPoints', 'errors:customPointsImportTooManyPoints'],
    ])('a refused file (%s) gets its own message, no dialog', async (reason, text) => {
      deps.previewImport.mockResolvedValueOnce({ ok: false, reason });

      await pick(new File(['x'], 'points.json'));

      expect(errorToast.error.mock.lastCall[0]).toContain(text);
      expect(overlayController.tryClose()).toBe(false);
    });

    it('the limit is in the "too many markers" message', async () => {
      deps.previewImport.mockResolvedValueOnce({ ok: false, reason: 'tooManyPoints' });

      await pick(new File(['x'], 'points.json'));

      expect(errorToast.error.mock.lastCall[0]).toContain('"max":5000');
    });

    it('a refusal at the import itself is reported too', async () => {
      deps.importFile.mockResolvedValueOnce({ ok: false, reason: 'checksumMismatch' });
      await pick(new File(['x'], 'points.json'));

      dialogButton('confirm').click();
      await settle();

      expect(errorToast.error.mock.lastCall[0]).toContain('errors:customPointsImportDamaged');
    });

    it('an unexpected failure is reported, not thrown, and the buttons come back', async () => {
      deps.previewImport.mockRejectedValueOnce(new Error('boom'));

      await pick(new File(['x'], 'points.json'));

      expect(errorToast.error).toHaveBeenCalledWith(
        expect.stringContaining('errors:customPointsImportUnreadable'),
        expect.anything(),
      );
      expect(button('import').disabled).toBe(false);
    });

    it('the chooser is cleared after a pick, so the same file fires a change again', async () => {
      // jsdom fires a change for the same file anyway: watch the clearing itself
      const setValue = vi.fn();
      Object.defineProperty(fileInput(), 'value', { set: setValue, get: () => '', configurable: true });

      await pick(new File(['x'], 'points.json'));

      expect(setValue).toHaveBeenCalledWith('');
    });
  });
});
