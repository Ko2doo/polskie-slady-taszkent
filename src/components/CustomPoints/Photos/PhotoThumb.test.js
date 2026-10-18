import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { getPhotoUrl, releasePhotoUrl } from '@/services/customPointsPhotos';
import { reactiveProps } from '@/test/reactiveProps.svelte.js';
import PhotoThumb from './PhotoThumb.svelte';

vi.mock('@/services/customPointsPhotos', () => ({ getPhotoUrl: vi.fn(), releasePhotoUrl: vi.fn() }));

let target;
let component;

function render(props) {
  component = mount(PhotoThumb, { target, props });
  flushSync();
}

// Let the url promise resolve and the component re-render
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  flushSync();
}

beforeEach(() => {
  getPhotoUrl.mockReset().mockImplementation(async (path) => `blob:${path}`);
  releasePhotoUrl.mockReset();
  target = document.createElement('div');
  document.body.append(target);
});

afterEach(() => {
  if (component) unmount(component);
  component = null;
  target.remove();
});

describe('PhotoThumb', () => {
  it('shows a placeholder, then the photo once its url is resolved', async () => {
    render({ path: 'photos/a/1.jpg', alt: 'Dom', class: 'size-10' });

    expect(target.querySelector('img')).toBeNull();
    expect(target.querySelector('div.animate-pulse.size-10')).not.toBeNull();

    await settle();

    const image = target.querySelector('img');
    expect(image.getAttribute('src')).toBe('blob:photos/a/1.jpg');
    expect(image.getAttribute('alt')).toBe('Dom');
    expect(image.getAttribute('loading')).toBe('lazy');
  });

  it('a photo that can not be read stays a placeholder', async () => {
    getPhotoUrl.mockRejectedValueOnce(new Error('Permission denied'));
    render({ path: 'photos/a/1.jpg' });

    await settle();

    expect(target.querySelector('img')).toBeNull();
  });

  it('a missing photo stays a placeholder', async () => {
    getPhotoUrl.mockResolvedValueOnce(null);
    render({ path: 'photos/a/1.jpg' });

    await settle();

    expect(target.querySelector('img')).toBeNull();
  });

  // Historical articles ship their photos as static files
  it('an asset is shown by its path at once, nothing is resolved or released', () => {
    render({ path: 'previews/l01.webp', source: 'asset' });

    expect(target.querySelector('img').getAttribute('src')).toBe('previews/l01.webp');

    unmount(component);
    component = null;

    expect(getPhotoUrl).not.toHaveBeenCalled();
    expect(releasePhotoUrl).not.toHaveBeenCalled();
  });

  it('releases its photo url when it goes away', async () => {
    render({ path: 'photos/a/1.jpg' });
    await settle();

    unmount(component);
    component = null;

    expect(releasePhotoUrl).toHaveBeenCalledWith('photos/a/1.jpg');
  });

  it('a new path releases the old url and shows the new photo', async () => {
    const props = reactiveProps({ path: 'photos/a/1.jpg' });
    render(props);
    await settle();

    props.path = 'photos/a/2.jpg';
    flushSync();
    await settle();

    expect(releasePhotoUrl).toHaveBeenCalledWith('photos/a/1.jpg');
    expect(target.querySelector('img').getAttribute('src')).toBe('blob:photos/a/2.jpg');
  });

  // The old url resolves after the path changed: it must not overwrite the new photo
  it('a late url of the previous path is ignored', async () => {
    let finishOld;
    getPhotoUrl.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = () => resolve('blob:old');
        }),
    );
    const props = reactiveProps({ path: 'photos/a/1.jpg' });
    render(props);

    props.path = 'photos/a/2.jpg';
    flushSync();
    await settle();
    finishOld();
    await settle();

    expect(target.querySelector('img').getAttribute('src')).toBe('blob:photos/a/2.jpg');
  });
});
