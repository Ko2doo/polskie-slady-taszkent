import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { translations } from '@/locales/collections';
import LangSwitcher from './LangSwitcher.svelte';

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
// Konsta makes a closed popover click-through, and its backdrop invisible
const popoverIsOpen = () => !languageButton('en').closest('.k-popover').classList.contains('pointer-events-none');
const backdrop = () => document.body.querySelector('[class*="bg-black/50"]');

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

  it('an unknown language shows an empty button', () => {
    render('xx');

    expect(target.querySelector('.popover-trigger').textContent.trim()).toBe('');
  });

  it('the button opens the language list', () => {
    render('en');
    expect(popoverIsOpen()).toBe(false);

    target.querySelector('.popover-trigger').click();
    flushSync();

    expect(popoverIsOpen()).toBe(true);
  });

  it('picking a language switches i18next to it and closes the list', () => {
    render('en');
    target.querySelector('.popover-trigger').click();
    flushSync();

    languageButton('uz').click();
    flushSync();

    expect(changeLanguage).toHaveBeenCalledTimes(1);
    expect(changeLanguage).toHaveBeenCalledWith('uz');
    expect(popoverIsOpen()).toBe(false);
  });

  it('picking reads the language from the button itself, not from a global event', () => {
    vi.stubGlobal('event', { target: { value: 'pl' } });
    render('en');

    languageButton('ru').click();

    expect(changeLanguage).toHaveBeenCalledWith('ru');
  });

  it('the backdrop closes the list without switching', () => {
    render('en');
    target.querySelector('.popover-trigger').click();
    flushSync();

    backdrop().click();
    flushSync();

    expect(popoverIsOpen()).toBe(false);
    expect(changeLanguage).not.toHaveBeenCalled();
  });
});
