import { describe, it, expect, vi } from 'vitest';
import { get } from 'svelte/store';
import i18next from 'i18next';
import { createI18nStore } from '@/store/i18nextSvelte/i18nextSvelte';

// A real, isolated i18next instance: the store must re-emit it on every i18next change event
async function createI18n() {
  const instance = i18next.createInstance();
  await instance.init({
    lng: 'en',
    resources: { en: { ui: { hello: 'Hello' } }, pl: { ui: { hello: 'Cześć' } } },
  });
  return instance;
}

describe('createI18nStore', () => {
  it('exposes the i18next instance through the store contract', async () => {
    const instance = await createI18n();
    const { i18n } = createI18nStore(instance);

    expect(get(i18n).t('ui:hello')).toBe('Hello');
  });

  it('notifies subscribers when the language changes, so $i18n.t re-renders', async () => {
    const instance = await createI18n();
    const { i18n } = createI18nStore(instance);
    const subscriber = vi.fn();
    i18n.subscribe(subscriber);
    subscriber.mockClear();

    await instance.changeLanguage('pl');

    expect(subscriber).toHaveBeenCalled();
    expect(get(i18n).t('ui:hello')).toBe('Cześć');
  });

  it('is loading until resources are loaded', async () => {
    const instance = await createI18n();
    const { isLoading } = createI18nStore(instance);

    expect(get(isLoading)).toBe(true);

    instance.emit('loaded', {});
    expect(get(isLoading)).toBe(true);

    instance.emit('loaded', { en: ['ui'] });
    expect(get(isLoading)).toBe(false);
  });

  it('reports a failed load', async () => {
    const instance = await createI18n();
    const { isError } = createI18nStore(instance);

    expect(get(isError)).toBe(false);

    instance.emit('failedLoading', 'en', 'ui', 'network');

    expect(get(isError)).toBe(true);
  });
});
