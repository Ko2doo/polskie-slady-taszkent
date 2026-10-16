import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import SearchBar from '@/components/SearchBar.svelte';

// Translations of the searchable fields: `articles:<id>:<field>`
const TEXTS = {
  'articles:l01:title': 'Kościół Najświętszego Serca',
  'articles:l01:description': 'Neogothic church',
  'articles:l02:title': 'Cmentarz',
  'articles:l02:description': 'Old   cemetery   of Tashkent',
  'articles:l03:title': 'Дом Полонского',
  'articles:l03:description': '',
};
const i18n = {
  subscribe(listener) {
    listener({ t: (key) => TEXTS[key] ?? key });
    return () => {};
  },
};
const ITEMS = [{ id: 'l01' }, { id: 'l02' }, { id: 'l03' }];

let target;
let component;
let onResults;
let onQueryChange;
let onHideBar;

function render(props = {}) {
  component = mount(SearchBar, {
    target,
    props: { i18n, items: ITEMS, onResults, onQueryChange, onHideBar, ...props },
  });
  flushSync();
}

const input = () => target.querySelector('input');
const lastIds = () => onResults.mock.lastCall[0].map((item) => item.id);

function search(text) {
  input().value = text;
  input().dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
}

beforeEach(() => {
  onResults = vi.fn();
  onQueryChange = vi.fn();
  onHideBar = vi.fn();
  target = document.createElement('div');
  document.body.append(target);
});

afterEach(() => {
  unmount(component);
  target.remove();
});

describe('SearchBar', () => {
  it('starts with every item', () => {
    render();

    expect(lastIds()).toEqual(['l01', 'l02', 'l03']);
  });

  it('finds by title or description, case-insensitive', () => {
    render();

    search('CEMETERY');
    expect(lastIds()).toEqual(['l02']);

    search('neogothic');
    expect(lastIds()).toEqual(['l01']);
    expect(onQueryChange).toHaveBeenLastCalledWith('neogothic');
  });

  // A phone keyboard without Polish letters: "swietego" must still find "Świętego"
  it('ignores diacritics and extra spaces', () => {
    render();

    search('najswietszego');
    expect(lastIds()).toEqual(['l01']);

    search('  old cemetery ');
    expect(lastIds()).toEqual(['l02']);
  });

  it('searches Cyrillic too', () => {
    render();

    search('полонск');

    expect(lastIds()).toEqual(['l03']);
  });

  it('no match: an empty list; an empty query: everything', () => {
    render();

    search('zzz');
    expect(lastIds()).toEqual([]);

    search('   ');
    expect(lastIds()).toEqual(['l01', 'l02', 'l03']);
  });

  it('starts filtered by an initial value', () => {
    render({ value: 'cmentarz' });

    expect(lastIds()).toEqual(['l02']);
  });
});
