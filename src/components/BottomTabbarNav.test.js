import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { bottomTabbarState, resetTabbar, setTabbar } from '@/lib/state/bottomTabbarNav.svelte.js';
import { i18nStub } from '@/test/i18nStub';
import HandbookIcon from '@/lib/icons/HandbookIcon.svelte';
import PaperMapIcon from '@/lib/icons/PaperMapIcon.svelte';
import BottomTabbarNav from '@/components/BottomTabbarNav.svelte';

// The router: its link action is a no-op, the current path is set by the test
const router = vi.hoisted(() => ({ path: '/' }));
vi.mock('@mateothegreat/svelte5-router', () => ({
  route: () => ({ destroy() {} }),
  registry: {
    instances: {
      values: () => [{ current: { result: { path: { original: router.path } } } }][Symbol.iterator](),
    },
  },
}));

let target;
let component;

function render(path) {
  router.path = path;
  component = mount(BottomTabbarNav, { target, props: { i18n: i18nStub } });
  flushSync();
}

const tabs = () => [...target.querySelectorAll('nav a')];

function iconMarkup(Icon, isActive) {
  const holder = document.createElement('div');
  const icon = mount(Icon, {
    target: holder,
    props: { className: 'size-7', strokeColor: 'currentColor', isActive },
  });
  flushSync();
  const markup = holder.querySelector('svg').innerHTML;
  unmount(icon);
  return markup;
}

beforeEach(() => {
  resetTabbar();
  target = document.createElement('div');
  document.body.append(target);
});

afterEach(() => {
  unmount(component);
  target.remove();
});

describe('BottomTabbarNav', () => {
  it('links the map, the handbook and the menu', () => {
    render('/');

    expect(tabs().map((tab) => tab.getAttribute('href'))).toEqual(['/', '/handbook', '/more']);
    expect(tabs()[1].textContent.trim()).toBe('ui:navbar:handbook:title');
  });

  it('the tab of the current screen gets the active icon', () => {
    render('/handbook');

    expect(tabs()[1].querySelector('svg').innerHTML).toBe(iconMarkup(HandbookIcon, true));
  });

  // "/" is a prefix of every path: the map tab must not light up on other screens
  it('the map tab is active only on the map itself', () => {
    render('/handbook');

    expect(tabs()[0].querySelector('svg').innerHTML).toBe(iconMarkup(PaperMapIcon, false));

    unmount(component);
    render('/');
    expect(tabs()[0].querySelector('svg').innerHTML).toBe(iconMarkup(PaperMapIcon, true));
  });

  it('is hidden when a screen hides it', () => {
    setTabbar({ isVisible: false });
    render('/settings');

    expect(target.querySelector('nav')).toBeNull();
    expect(bottomTabbarState.isVisible).toBe(false);
  });
});
