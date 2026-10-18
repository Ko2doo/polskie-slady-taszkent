import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { goto } from '@mateothegreat/svelte5-router';
import { articlePopupState } from '@/lib/state/article.svelte';
import { articlesMeta } from '@/data/articles';
import { overlayState } from '@/store/ui/overlayController';
import { i18nStub } from '@/test/i18nStub';
import Article from '@/components/Article.svelte';

vi.mock('@mateothegreat/svelte5-router', () => ({ goto: vi.fn() }));
// Custom points come from a fixed list (customPointsState.test.js covers the real state)
const customPoints = vi.hoisted(() => new Map());
vi.mock('@/lib/state/customPointsState.svelte', () => ({
  customPointsState: { getById: (id) => customPoints.get(id) ?? null },
}));
vi.mock('@/utils/swiperAction', () => ({ swiperInstance: vi.fn(() => ({ destroy() {} })) }));
vi.mock('@/services/customPointsPhotos', () => ({
  getPhotoUrl: vi.fn(async (path) => `blob:${path}`),
  releasePhotoUrl: vi.fn(),
}));

const CUSTOM_ID = '11111111-1111-4111-8111-111111111111';
const HOSTILE = '<img src=x onerror="alert(1)">\nline two';

let target;
let component;

function open(id) {
  articlePopupState.open(id);
  flushSync();
}

const heading = () => document.body.querySelector('h1');
const text = () => heading()?.nextElementSibling;
const toMapButton = () =>
  [...document.body.querySelectorAll('button')].find((button) => button.textContent.includes('ui:buttons:toMaps'));

beforeEach(() => {
  goto.mockClear();
  customPoints.clear();
  customPoints.set(CUSTOM_ID, {
    id: CUSTOM_ID,
    title: 'Mój dom',
    description: HOSTILE,
    photos: [],
    coords: { lng: 69.25, lat: 41.31 },
  });
  overlayState.set({ stack: [] });
  articlePopupState.close();

  target = document.createElement('div');
  document.body.append(target);
  component = mount(Article, { target, props: { i18n: i18nStub } });
  flushSync();
});

afterEach(() => {
  articlePopupState.close();
  unmount(component);
  target.remove();
});

describe('Article', () => {
  it('shows nothing until an article is opened', () => {
    expect(heading()).toBeNull();
  });

  it('a historical place: translated title and description, its preview photos', () => {
    const place = articlesMeta.find((meta) => meta.photos.some(Boolean));
    open(place.id);

    expect(heading().textContent.trim()).toBe(`articles:${place.id}:title`);
    expect(text().textContent.trim()).toBe(`articles:${place.id}:description`);
    expect(document.body.querySelector(`img[src="${place.photos[0]}"]`)).not.toBeNull();
  });

  it('a place without a photo shows no slider', () => {
    const place = articlesMeta.find((meta) => !meta.photos.some(Boolean));
    open(place.id);

    expect(document.body.querySelectorAll('.swiper-slide, img')).toHaveLength(0);
    expect(document.body.querySelector('button.block')).toBeNull();
  });

  // The user's own text: shown as typed, line breaks kept, never parsed as HTML
  it('a custom point: its own title and text, as plain text', () => {
    open(CUSTOM_ID);

    expect(heading().textContent.trim()).toBe('Mój dom');
    expect(text().textContent.trim()).toBe(HOSTILE);
    expect(text().querySelector('img')).toBeNull();
    expect(text().classList.contains('whitespace-pre-line')).toBe(true);
  });

  it('an unknown id shows nothing', () => {
    open('nope');

    expect(heading()).toBeNull();
  });

  it('"to the map" closes the popup and opens the map at the place', () => {
    open(CUSTOM_ID);

    toMapButton().click();
    flushSync();

    expect(articlePopupState.isOpen).toBe(false);
    expect(goto).toHaveBeenCalledWith('/?lon=69.25&lat=41.31');
  });

  it('a historical place opens the map at its [lat, lon]', () => {
    const [place] = articlesMeta;
    open(place.id);

    toMapButton().click();

    const [lat, lon] = place.coords;
    expect(goto).toHaveBeenCalledWith(`/?lon=${lon}&lat=${lat}`);
  });

  it('the back link closes the popup', () => {
    open(CUSTOM_ID);

    document.body.querySelector('.navbar a, a').click();
    flushSync();

    expect(articlePopupState.isOpen).toBe(false);
  });

  it('the back link has an accessible name', () => {
    open(CUSTOM_ID);

    // An icon-only link: without an aria-label a screen reader announces nothing
    expect(document.body.querySelector('.navbar a, a').getAttribute('aria-label')).toBe('ui:buttons:back');
  });
});
