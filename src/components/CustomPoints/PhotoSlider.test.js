import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { get } from 'svelte/store';
import { swiperInstance } from '@/utils/swiperAction';
import { overlayController, overlayState } from '@/store/ui/overlayController';
import { i18nStub } from '@/test/i18nStub';
import PhotoSlider from '@/components/CustomPoints/PhotoSlider.svelte';

// Swiper needs real layout: the action is a recorder of the options each slider was created with.
// The photo urls are not the point here (PhotoThumb.test.js covers them).
vi.mock('@/utils/swiperAction', () => ({ swiperInstance: vi.fn(() => ({ destroy() {} })) }));
vi.mock('@/services/customPointsPhotos', () => ({
  getPhotoUrl: vi.fn(async (path) => `blob:${path}`),
  releasePhotoUrl: vi.fn(),
}));

const PHOTOS = ['photos/a/1.jpg', 'photos/a/2.jpg', 'photos/a/3.jpg'];

let target;
let component;

function render(props) {
  component = mount(PhotoSlider, { target, props: { i18n: i18nStub, alt: 'Dom', ...props } });
  flushSync();
}

// The viewer is portaled to <body>, outside the target
const viewer = () => document.body.querySelector('[role="dialog"]');
const swiperOptions = () => swiperInstance.mock.calls.map(([, options]) => options);

beforeEach(() => {
  swiperInstance.mockClear();
  overlayState.set({ stack: [] });
  target = document.createElement('div');
  document.body.append(target);
});

afterEach(() => {
  if (component) unmount(component);
  component = null;
  target.remove();
});

describe('PhotoSlider', () => {
  it('no photos: renders nothing', () => {
    render({ photos: [] });

    expect(target.children).toHaveLength(0);
  });

  it('one photo: shown directly, no slider', () => {
    render({ photos: ['photos/a/1.jpg'] });

    expect(target.querySelectorAll('button')).toHaveLength(1);
    expect(swiperInstance).not.toHaveBeenCalled();
  });

  it('several photos: one slide each, a single slider with dots', () => {
    render({ photos: PHOTOS });

    expect(target.querySelectorAll('.swiper-slide')).toHaveLength(3);
    expect(swiperOptions()).toHaveLength(1);
    expect(swiperOptions()[0]).toMatchObject({ slidesPerView: 1, pagination: { clickable: true } });
    expect(swiperOptions()[0].pagination.el).toBeInstanceOf(HTMLElement);
  });

  it('the viewer is closed at first', () => {
    render({ photos: PHOTOS });

    expect(viewer()).toBeNull();
  });

  it('tapping a photo opens the fullscreen viewer at that photo', () => {
    render({ photos: PHOTOS });

    target.querySelectorAll('.swiper-slide button')[2].click();
    flushSync();

    expect(viewer()).not.toBeNull();
    expect(swiperOptions().at(-1)).toMatchObject({ zoom: true, initialSlide: 2 });
    expect(viewer().querySelectorAll('.swiper-zoom-container')).toHaveLength(3);
  });

  it('the close button closes the viewer and frees the back button', () => {
    render({ photos: PHOTOS });
    target.querySelector('.swiper-slide button').click();
    flushSync();

    viewer().querySelector('button[aria-label="ui:photoViewer:close"]').click();
    flushSync();

    expect(viewer()).toBeNull();
    expect(get(overlayState).stack).toHaveLength(0);
  });

  // The viewer sits on the overlay stack: Android back closes it before anything else
  it('the Android back button closes the viewer', () => {
    render({ photos: PHOTOS });
    target.querySelector('.swiper-slide button').click();
    flushSync();

    expect(overlayController.tryClose()).toBe(true);
    flushSync();

    expect(viewer()).toBeNull();
  });

  it('a single photo opens the viewer too, without dots', () => {
    render({ photos: ['photos/a/1.jpg'] });

    target.querySelector('button').click();
    flushSync();

    expect(viewer()).not.toBeNull();
    expect(swiperOptions().at(-1).pagination).toBe(false);
  });
});
