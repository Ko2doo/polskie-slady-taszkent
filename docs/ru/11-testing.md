# Тесты и качество кода

## Запуск

```bash
npm test
npm run test:watch
npm run test:coverage
npx vitest run src/services/customPointsMerge.test.js
```

Стек: **Vitest** + **jsdom** + **fake-indexeddb**. Последний нужен, чтобы веб-реализация плагина
Filesystem работала в тестах по-настоящему. Конфиг `vitest.config.js` наследует
`vite.config.js`, поэтому в тестах работают тот же алиас `@`, плагины и глобальные константы
сборки. Тестами считаются только файлы `src/**/*.test.js`.

## Что тестировать

- Логику: сервисы, состояние, сторы, обёртки Capacitor, компоненты с ветвлениями, обработчиками
  или эффектами.
- Не тестируются: статические данные (`data/`, `locales/` — кроме паритета ключей), таблица
  маршрутов, файлы констант, иконки, компоненты из одной разметки.
- Новая функция: обычный путь, граничные случаи (пустой ввод, ровно лимит, лимит + 1) и путь
  отказа.
- Исправление бага: тест, который падает без исправления и проходит с ним.
- Функции, которые экранируют пользовательский текст для HTML или путей, проверяются на
  враждебном вводе.

Перед PR весь набор должен быть зелёным, а не только новые тесты.

## Где лежат тесты

Тест лежит рядом с модулем: `utils/crc32.js` → `utils/crc32.test.js`. Тест, который сам
использует руны (`$state`, `$effect.root`), называется `*.svelte.test.js`.

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRateLimiter } from '@/utils/rateLimiter';

let limiter;

beforeEach(() => {
  vi.useFakeTimers();
  limiter = createRateLimiter({ windowMs: 1000, maxPerWindow: 3 });
});

afterEach(() => vi.useRealTimers());

describe('createRateLimiter', () => {
  it('lets the first maxPerWindow hits of a key through, limits the next ones', () => {
    const hits = Array.from({ length: 5 }, () => limiter.isLimited('a'));
    expect(hits).toEqual([false, false, false, true, true]);
  });
});
```

## Компоненты

Компонент монтируется по-настоящему (`mount`/`unmount`/`flushSync` из `svelte`), тест работает
через DOM и проверяет то, что видит пользователь.

```js
import { flushSync, mount, unmount } from 'svelte';
import SearchBar from '@/components/SearchBar.svelte';

const i18n = {
  subscribe(listener) {
    listener({ t: (key) => key });
    return () => {};
  },
};

const target = document.createElement('div');
const component = mount(SearchBar, { target, props: { i18n, items: [], onResults: vi.fn() } });
flushSync();

unmount(component);
```

- `i18n`-заглушка возвращает ключ, поэтому проверяется, какой ключ отрендерился. Готовая
  заглушка — `src/test/i18nStub.js`. Реальные локали подключает `src/test/realI18n.js`: так
  пропущенная строка в одном из языков роняет тест.
- Konsta `Dialog`/`Sheet`/`Actions` рендерят содержимое и в закрытом состоянии. Элементы
  ищутся по тексту или `aria-label`, а не по видимости.
- `src/test/setup.js` подменяет `Element.prototype.animate`: в jsdom его нет, а переходам Svelte
  он нужен.

## Хелперы (`src/test/`)

| Хелпер | Для чего |
| --- | --- |
| `mapRecorders.js` | Рекордеры MapLibre: `Marker`, `Popup`, `LngLatBounds`, стиль (источники, слои, изображения, `resetStyle()`), `stubImageLoading()`, `routeResult()` |
| `gpsTrackerRecorder.js` | `createTrackerRecorder()` — трекер, которым управляет тест: `move(position)`, `fail(error)` |
| `i18nStub.js`, `realI18n.js` | Заглушка i18n и реальные локали |
| `reactiveProps.svelte.js` | Реактивные пропсы: изменить проп смонтированного компонента, как это сделал бы родитель |
| `RenderSnippet.svelte` | Рендер сниппета, который экран отдал в навбар или панель |
| `EmptyComponent.svelte` | Замена тяжёлого дочернего компонента через `vi.mock(path, () => ({ default: EmptyComponent }))` |
| `ContextProbe.svelte` | Чтение значения контекста |

## Моки

- **Плагины Capacitor.** Лучше гонять настоящую веб-реализацию: она ловит неправильные опции,
  каталоги и кодировки. Мок нужен только для поведения, которое бывает лишь на устройстве. Экспорт
  плагина — Proxy, поэтому `vi.spyOn(Filesystem, ...)` не работает. Пакет мокается через
  `vi.mock`, каждый метод оборачивается в `vi.fn`, который по умолчанию вызывает веб-реализацию.
  Ошибка устройства подставляется через `mockRejectedValueOnce(...)`. Пример:
  `capacitor/utils/appFiles.test.js`.
- **Мок как рекордер.** Мок записывает все вызовы, а не только возвращает готовое значение:
  тест проверяет, что именно вызвали и сколько раз.
- **Внедрённые зависимости.** `createCustomPointsStorage({ driver })` тестируется с рекордером
  драйвера в памяти плюс одним интеграционным тестом на реальном драйвере
  (`services/customPointsStorage.test.js`).
- **Синглтоны** (`customPointsState`, `articlePopupState`, `themeManager`, `errorToast`)
  сохраняют состояние между тестами одного файла. Сбрасывайте их в `beforeEach` или получайте
  свежий экземпляр через `vi.resetModules()` + динамический `import()`.
- `restoreMocks`, `unstubGlobals`, `unstubEnvs` включены в конфиге, поэтому `vi.spyOn`,
  `vi.stubGlobal` и `vi.stubEnv` откатываются автоматически.

## Самопроверка

Для важной логики (целостность данных, лимиты, счётчики ссылок, стек оверлеев) сломайте код
так, как сломала бы его будущая регрессия: уберите проверку, переверните условие. Тест должен
упасть. Если он не падает, он это свойство не проверяет.

## Тесты, которые проверяют сам проект

| Тест | Проверяет |
| --- | --- |
| `src/locales/resources.test.js` | Паритет ключей, подстановок и HTML-тегов во всех локалях |
| `src/lib/errors/errorCodes.test.js` | Нет литералов кодов ошибок в обход `ERROR_CODES` |
| `src/docsParity.test.js` | `docs/ru` и `docs/en`: одинаковые файлы, структура заголовков, код примеров |
| `src/architectureTree.test.js`, `src/repositoryTree.test.js`, `src/harnessPaths.test.js` | Правила для агента и документация совпадают с реальным деревом файлов |

## Линтер и форматирование

```bash
npm run lint
npm run lint:fix
npm run format
npm run format:check
```

ESLint (`eslint.config.js`) проверяет:

- нет `console.*`, нужен логгер `utils/debugMode.js`;
- нет неиспользуемых переменных и импортов (`_name` помечает параметр, который нужен только
  ради позиции);
- `const` везде, где нет переприсваивания;
- JSDoc на каждой экспортируемой функции и классе;
- границы импортов: плагины только из `capacitor/`, новых классических сторов нет.

Prettier: точка с запятой; одинарные кавычки в `.js`, двойные в `.svelte`; ширина 120 символов.
`npm run build` запускает lint и format:check первыми, CI тоже. Правило отключается только на
одной строке и с причиной:

```js
// eslint-disable-next-line svelte/no-at-html-tags -- markup from our own locale files
```
