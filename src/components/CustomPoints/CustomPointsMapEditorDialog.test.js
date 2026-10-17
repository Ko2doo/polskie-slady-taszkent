import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { chooseFromGallery, PhotoPickerError, takePhoto } from '@/capacitor/services/photoPicker';
import { LIMITS } from '@/services/customPointsFormat';
import { deletePhotoFiles, deletePointPhotos, pruneUnreferenced, savePhoto } from '@/services/customPointsPhotos';
import { errorToast } from '@/store/ui/errorToast';
import { get } from 'svelte/store';
import { overlayController, overlayState } from '@/store/ui/overlayController';
import { i18nStub } from '@/test/i18nStub';
import { reactiveProps } from '@/test/reactiveProps.svelte.js';
import { isId } from '@/utils/uuid';
import EditorDialog from '@/components/CustomPoints/CustomPointsMapEditorDialog.svelte';

// The real photo session runs inside the form; the picker and the files are recorders
// (photoSession.test.js and customPointsPhotos.test.js cover those for real)
vi.mock('@/capacitor/services/photoPicker', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, takePhoto: vi.fn(), chooseFromGallery: vi.fn() };
});
vi.mock('@/services/customPointsPhotos', () => ({
  savePhoto: vi.fn(),
  deletePhotoFiles: vi.fn(async () => {}),
  deletePointPhotos: vi.fn(async () => {}),
  pruneUnreferenced: vi.fn(async () => 0),
  getPhotoUrl: vi.fn(async (path) => `blob:${path}`),
  releasePhotoUrl: vi.fn(),
}));
vi.mock('@/store/ui/errorToast', () => ({ errorToast: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const POINT = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Kościół',
  description: 'Opis',
  photos: ['photos/11111111-1111-4111-8111-111111111111/a.jpg', 'photos/11111111-1111-4111-8111-111111111111/b.jpg'],
};

let target;
let component;
let props;

function render(overrides = {}) {
  props = reactiveProps({
    i18n: i18nStub,
    coords: { lng: 69.2401234, lat: 41.3009876 },
    opened: true,
    editingPoint: null,
    onCloseModal: vi.fn(),
    onSave: vi.fn(() => true),
    onDelete: vi.fn(() => true),
    ...overrides,
  });
  component = mount(EditorDialog, { target, props });
  flushSync();
}

const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  flushSync();
};

const button = (text) => [...document.body.querySelectorAll('button')].find((item) => item.textContent.trim() === text);
const titleInput = () => document.body.querySelector('input');
const descriptionInput = () => document.body.querySelector('textarea');
const toolbarLinks = () => [...document.body.querySelectorAll('a')];
const thumbs = () => [...document.body.querySelectorAll('[aria-label="ui:map:mapEditor:photosSetCover"]')];
const shownPhotos = () => thumbs().map((thumb) => thumb.querySelector('img')?.getAttribute('src'));

function type(element, value) {
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
}

function click(element) {
  element.click();
  flushSync();
}

beforeEach(() => {
  // vi.fn()s created inside vi.mock are not reset by restoreMocks
  [takePhoto, chooseFromGallery, savePhoto, deletePhotoFiles, deletePointPhotos, pruneUnreferenced].forEach((fn) =>
    fn.mockClear(),
  );
  savePhoto.mockReset().mockImplementation(async ({ pointId, source }) => `photos/${pointId}/${source.uri}`);
  Object.values(errorToast).forEach((fn) => fn.mockClear());
  target = document.createElement('div');
  document.body.append(target);
});

afterEach(() => {
  if (component) unmount(component);
  component = null;
  target.remove();
});

describe('a new point', () => {
  it('shows the create title and the coordinates, no delete button', () => {
    render();

    expect(document.body.textContent).toContain('ui:map:mapEditor:modalTitleCreate');
    expect(document.body.textContent).toContain('"coords":"41.300988, 69.240123"');
    expect(toolbarLinks()).toHaveLength(1);
  });

  it('the inputs stop at the limits', () => {
    render();

    expect(titleInput().getAttribute('maxlength')).toBe(String(LIMITS.title));
    expect(descriptionInput().getAttribute('maxlength')).toBe(String(LIMITS.description));
  });

  it('an empty title is not saved', () => {
    render();
    type(titleInput(), '   ');

    click(button('ui:map:mapEditor:save'));

    expect(props.onSave).not.toHaveBeenCalled();
  });

  it('saves the trimmed texts with an id created when the form opened, then clears the form', async () => {
    render();
    type(titleInput(), '  Dom  ');
    type(descriptionInput(), ' Tekst ');

    click(button('ui:map:mapEditor:save'));
    await settle();

    const [saved] = props.onSave.mock.lastCall;
    expect(saved).toEqual({ title: 'Dom', description: 'Tekst', photos: [], pointId: expect.any(String) });
    expect(isId(saved.pointId)).toBe(true);
    expect(pruneUnreferenced).toHaveBeenCalledWith(saved.pointId, []);
    expect(titleInput().value).toBe('');
  });

  it('a failed save keeps what was typed and the photos', async () => {
    render({ onSave: vi.fn(() => false) });
    type(titleInput(), 'Dom');

    click(button('ui:map:mapEditor:save'));
    await settle();

    expect(titleInput().value).toBe('Dom');
    expect(pruneUnreferenced).not.toHaveBeenCalled();
  });

  // The photos taken for a point that was never saved must not stay on the disk
  it('cancel deletes the photo folder of the unsaved point and closes', async () => {
    render();
    type(titleInput(), 'Dom');

    click(button('ui:map:mapEditor:cancel'));
    await settle();

    expect(deletePointPhotos).toHaveBeenCalledWith(expect.any(String));
    expect(props.onCloseModal).toHaveBeenCalled();
    expect(titleInput().value).toBe('');
  });

  it('the close icon does the same as cancel', async () => {
    render();

    click(toolbarLinks()[0]);
    await settle();

    expect(deletePointPhotos).toHaveBeenCalled();
    expect(props.onCloseModal).toHaveBeenCalled();
  });
});

describe('editing a point', () => {
  it('fills the form with the point and shows the update texts and the delete button', async () => {
    render({ editingPoint: POINT });
    await settle();

    expect(titleInput().value).toBe('Kościół');
    expect(descriptionInput().value).toBe('Opis');
    expect(document.body.textContent).toContain('ui:map:mapEditor:modalTitleUpdates');
    expect(button('ui:map:mapEditor:update')).toBeTruthy();
    expect(toolbarLinks()).toHaveLength(2);
    expect(shownPhotos()).toEqual(POINT.photos.map((path) => `blob:${path}`));
  });

  it('saves under the id of the point', () => {
    render({ editingPoint: POINT });
    type(titleInput(), 'Nowy');

    click(button('ui:map:mapEditor:update'));

    expect(props.onSave.mock.lastCall[0]).toMatchObject({ title: 'Nowy', pointId: POINT.id, photos: POINT.photos });
  });

  // An existing point keeps its folder: only the photos added in this form go
  it('cancel keeps the original photos', async () => {
    render({ editingPoint: POINT });

    click(button('ui:map:mapEditor:cancel'));
    await settle();

    expect(deletePointPhotos).not.toHaveBeenCalled();
  });

  it('tapping a photo makes it the cover', async () => {
    render({ editingPoint: POINT });
    await settle();

    click(thumbs()[1]);
    await settle();
    click(button('ui:map:mapEditor:update'));

    expect(props.onSave.mock.lastCall[0].photos).toEqual([POINT.photos[1], POINT.photos[0]]);
  });

  it('a photo can be removed from the list', async () => {
    render({ editingPoint: POINT });
    await settle();

    click(document.body.querySelector('[aria-label="ui:map:mapEditor:photosRemove"]'));
    click(button('ui:map:mapEditor:update'));

    expect(props.onSave.mock.lastCall[0].photos).toEqual([POINT.photos[1]]);
  });

  it('reopening for another point shows that point', async () => {
    render({ editingPoint: POINT });
    props.opened = false;
    flushSync();

    props.editingPoint = { ...POINT, id: '22222222-2222-4222-8222-222222222222', title: 'Drugi', photos: [] };
    props.opened = true;
    flushSync();

    expect(titleInput().value).toBe('Drugi');
  });
});

describe('deleting', () => {
  it('asks first; confirming deletes the point', () => {
    render({ editingPoint: POINT });

    click(toolbarLinks()[0]);
    click(button('ui:map:mapEditor:delete'));

    expect(props.onDelete).toHaveBeenCalled();
    expect(errorToast.error).not.toHaveBeenCalled();
  });

  it('cancelling the question keeps the point', () => {
    render({ editingPoint: POINT });

    click(toolbarLinks()[0]);
    const cancels = [...document.body.querySelectorAll('button')].filter(
      (item) => item.textContent.trim() === 'ui:map:mapEditor:cancel',
    );
    click(cancels.at(-1));

    expect(props.onDelete).not.toHaveBeenCalled();
  });

  it('a failed delete tells the user and keeps the form', () => {
    render({ editingPoint: POINT, onDelete: vi.fn(() => false) });

    click(toolbarLinks()[0]);
    click(button('ui:map:mapEditor:delete'));

    expect(errorToast.error).toHaveBeenCalledWith('errors:customPointsDeleteFailed', expect.anything());
    expect(titleInput().value).toBe('Kościół');
  });
});

describe('adding photos', () => {
  it('a camera photo is saved into the point folder and shown with the counter', async () => {
    takePhoto.mockResolvedValueOnce([{ uri: 'cam.jpg' }]);
    render();

    click(button('ui:map:mapEditor:photosTake'));
    await settle();

    expect(thumbs()).toHaveLength(1);
    expect(document.body.querySelector('[aria-label^="ui:map:mapEditor:photosCount"]').textContent.trim()).toBe(
      `1 / ${LIMITS.maxPhotos}`,
    );
  });

  it('too many gallery photos: the extra ones are dropped with a warning', async () => {
    chooseFromGallery.mockResolvedValueOnce(
      Array.from({ length: LIMITS.maxPhotos + 1 }, (_, index) => ({ uri: `g${index}.jpg` })),
    );
    render();

    click(button('ui:map:mapEditor:photosChoose'));
    await settle();

    expect(thumbs()).toHaveLength(LIMITS.maxPhotos);
    expect(errorToast.warn).toHaveBeenCalledWith(`errors:customPointsPhotoLimit {"max":${LIMITS.maxPhotos}}`);
  });

  it('a denied permission warns, a failure is an error', async () => {
    takePhoto.mockRejectedValueOnce(new PhotoPickerError('denied'));
    render();

    click(button('ui:map:mapEditor:photosTake'));
    await settle();
    expect(errorToast.warn).toHaveBeenCalledWith('errors:customPointsPhotoDenied');

    takePhoto.mockRejectedValueOnce(new Error('boom'));
    click(button('ui:map:mapEditor:photosTake'));
    await settle();
    expect(errorToast.error).toHaveBeenCalledWith('errors:customPointsPhotoFailed');
  });

  it('a cancelled pick says nothing', async () => {
    takePhoto.mockResolvedValueOnce([]);
    render();

    click(button('ui:map:mapEditor:photosTake'));
    await settle();

    expect(errorToast.warn).not.toHaveBeenCalled();
    expect(errorToast.error).not.toHaveBeenCalled();
  });

  it('the add button is disabled when the list is full', async () => {
    render({
      editingPoint: {
        ...POINT,
        photos: Array.from({ length: LIMITS.maxPhotos }, (_, i) => `photos/${POINT.id}/${i}.jpg`),
      },
    });
    await settle();

    expect(button('ui:map:mapEditor:photosAdd').disabled).toBe(true);
  });
});

describe('the Android back button', () => {
  const stack = () => get(overlayState).stack;
  const back = () => {
    overlayController.tryClose();
    flushSync();
  };
  // Closes the editor by turning `opened` off, the way Map.svelte's edit-mode controller does
  const renderClosable = (overrides = {}) =>
    render({ onCloseModal: vi.fn(() => (props.opened = false)), ...overrides });

  it('is on the overlay stack only while the editor is open', () => {
    render({ opened: false });
    expect(stack()).toHaveLength(0);

    props.opened = true;
    flushSync();
    expect(stack()).toHaveLength(1);

    props.opened = false;
    flushSync();
    expect(stack()).toHaveLength(0);
  });

  // Same as cancel: the photos taken for a point that was never saved must not stay on the disk
  it('works like cancel: the unsaved point loses its photos and the editor closes', async () => {
    renderClosable();
    type(titleInput(), 'Dom');

    back();
    await settle();

    expect(deletePointPhotos).toHaveBeenCalledWith(expect.any(String));
    expect(props.onCloseModal).toHaveBeenCalled();
    expect(stack()).toHaveLength(0);
  });

  it('closes the photo source menu first, the editor on the next press', () => {
    renderClosable();
    click(button('ui:map:mapEditor:photosAdd'));

    back();
    expect(props.onCloseModal).not.toHaveBeenCalled();
    expect(stack()).toHaveLength(1);

    back();
    expect(props.onCloseModal).toHaveBeenCalled();
  });

  it('closes the delete question first, without deleting', () => {
    renderClosable({ editingPoint: POINT });
    click(toolbarLinks()[0]);

    back();

    expect(props.onDelete).not.toHaveBeenCalled();
    expect(props.onCloseModal).not.toHaveBeenCalled();
    expect(stack()).toHaveLength(1);
  });

  it('leaving the screen with the editor open leaves no overlay behind', () => {
    render();

    unmount(component);
    component = null;

    expect(stack()).toHaveLength(0);
  });
});
