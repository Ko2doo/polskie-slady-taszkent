# UI, стили, переводы

## Компоненты: сначала Konsta UI, потом Tailwind

1. **Konsta UI** (`konsta/svelte`) — по умолчанию для всего, что в нём есть: `Page`, `Navbar`,
   `Block`, `List`/`ListItem`, `Button`, `Dialog`, `Popup`, `Sheet`, `Actions`, `Panel`, `Toast`,
   `Radio`/`Toggle`, `Tabbar`. На обеих платформах используется тема **iOS**
   (`<App safeAreas theme="ios">` в `App.svelte`).
2. **Tailwind 4** — когда компонента в Konsta нет или нужен нестандартный вид. Также для
   отступов и раскладки вокруг Konsta-компонентов и для их подстройки через `class`.
3. **`<style>` в компоненте** — только для того, что утилитами выражается плохо: сложная
   раскладка, анимации, сплэш, онбординг.

Konsta-компонент не нужно оборачивать в свой ради другого стиля и не нужно переписывать на
Tailwind. Сначала используйте его пропсы, `class` и `colors`.

```svelte
<script>
  import { Block, Button } from "konsta/svelte";
</script>

<Block strong inset class="flex flex-col gap-4">
  <Button large rounded class="bg-brand-primary">{$i18n.t("ui:map:mapEditor:save")}</Button>
</Block>
```

## Тема и токены

- Цвета бренда — блок `@theme` в `src/App.css`: `--color-brand-primary`, `--color-brand-primary-dark`,
  `--color-brand-blue`, `--color-brand-green`. Из них получаются утилиты `bg-brand-primary`,
  `text-brand-blue`. **Новые токены добавляются сюда.**
- `tailwind.config.js` переопределяет `black`/`white` на `stone-800`/`stone-100` во всём
  приложении. Значения там литеральные (`colors.stone[800]`). Если записать
  `var(--color-black)`, ссылка на саму себя сломает модификаторы прозрачности.
- В обычном CSS цвет из JS-конфига читается через `--theme()`:
  `--k-color-text: --theme(--color-black)`. Переменной `--color-black` не существует.
- Tailwind 4 выдаёт цвета в `oklch` без hex-фолбэка. Минимальные версии: Android System
  WebView / Chrome 111+, iOS Safari 16.4+.
- CSS сторонних библиотек (`maplibre-gl`, `swiper`) подключается один раз в `src/App.css`.
  Стили того, что MapLibre рисует на карте (попапы, маркеры, атрибуция), лежат в
  `src/assets/styles/maplibre.css`. Типографика — `src/assets/styles/typography.css`.

## Тёмная тема

`lib/theme/themeManager.js` ставит класс `dark` на `<html>`. Его используют и Konsta, и `dark:`
в Tailwind. Переключатель — `components/Preferences/DarkModeToggler.svelte`.

```svelte
<p class="text-stone-700 dark:text-stone-200">...</p>
```

У карты свой стиль для тёмной темы (`views/Map/Session/MapTheme.svelte.js` +
`services/mapStyle.js`): CSS-класс не перекрашивает canvas MapLibre. Каждый новый элемент
проверяется в обеих темах. Литеральный hex допустим только как намеренный цвет бренда,
одинаковый в обеих темах.

## Переводы (i18next)

Четыре локали: `ru` (основная), `en`, `pl`, `uz`. Любой видимый текст, в том числе
`aria-label`, плейсхолдеры и тосты, идёт через i18next и добавляется во все четыре локали
в том же изменении.

```
locales/
├── resources.js        собирает все языки для i18next
├── collections.js      код → название языка для переключателя
└── {ru,en,pl,uz}/
    ├── index.js        экспорт пространств имён
    ├── ui.js           интерфейс: кнопки, заголовки, подсказки, aria-label
    ├── errors.js       тексты тостов и ошибок
    ├── articles.js     статьи исторических мест по id
    └── about.js        текст экрана «О приложении»
```

В компонентах `i18n` приходит пропом, текст берётся через `$i18n.t`:

```svelte
<script>
  let { i18n } = $props();
</script>

<span>{$i18n.t("ui:map:mapEditor:photosAdd")}</span>
<span>{$i18n.t("ui:map:mapEditor:photosCount", { count: photos.length, max: LIMITS.maxPhotos })}</span>
```

- Ключи вкладываются по фиче и компоненту (`ui:map:mapEditor:photosAdd`), плоский список не
  используется.
- Подстановки задаются через `{{name}}`, имена подстановок одинаковые во всех локалях.
- Длинная строка переносится так (пример из `locales/en/ui.js`):

```js
photosHint:
  'Up to {{max}} photos. The first photo becomes the cover of the marker.',
```

- Смена языка: `$i18n.changeLanguage(code)` (`components/Preferences/LangSwitcher.svelte`).
  Выбор хранится в Preferences под ключом `locale`. При первом запуске язык берётся с
  устройства (`@capacitor/device`). Запасной язык — `en`.
- Строки в `about.js` и описания статей намеренно содержат HTML. Разметка одинаковая во всех
  локалях и выводится через `{@html}`. Правило ESLint отключается только на этой строке, с
  причиной:

```svelte
<!-- eslint-disable-next-line svelte/no-at-html-tags -- markup from our own locale files -->
{@html $i18n.t("about:shortInfo")}
```

  Текст пользователя (метки) через `{@html}` не выводится никогда. `components/Article.svelte`
  различает источники флагом `isHtml`: статьи выводятся как HTML, метки как обычный текст.

Паритет проверяет `src/locales/resources.test.js`: во всех локалях ровно те же ключи, что в
`ru`, те же `{{подстановки}}` и те же HTML-теги в каждой строке (`<br>` не учитывается).
Пропущенный ключ в рантайме молча показал бы английский текст, тест это ловит.

Новый язык — это решение по продукту: новая папка, записи в `resources.js` и `collections.js`,
перевод статей и `about`.
