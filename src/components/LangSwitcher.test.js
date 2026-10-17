import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { translations } from '@/locales/collections';
import LangSwitcher from '@/components/LangSwitcher.svelte';

let target;
let component;
let changeLanguage;

function render(language) {
  const i18n = {
    subscribe(listener) {
      listener({ t: (key) => key, language, changeLanguage });
      return () => {};
    },
  };
  component = mount(LangSwitcher, { target, props: { i18n } });
  flushSync();
}

const languageButton = (code) => document.body.querySelector(`button[value="${code}"]`);

beforeEach(() => {
  changeLanguage = vi.fn();
  target = document.createElement('div');
  document.body.append(target);
});

afterEach(() => {
  unmount(component);
  target.remove();
});

describe('LangSwitcher', () => {
  it('shows the current language by its own name', () => {
    render('pl');

    expect(target.querySelector('.popover-trigger').textContent.trim()).toBe('Polski');
  });

  it('offers every language', () => {
    render('en');

    for (const code of Object.keys(translations)) {
      expect(languageButton(code).textContent.trim()).toBe(translations[code]);
    }
  });

  it('picking a language switches i18next to it', () => {
    render('en');

    languageButton('uz').click();

    expect(changeLanguage).toHaveBeenCalledWith('uz');
  });
});
