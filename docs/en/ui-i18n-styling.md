# UI, styling, translations

## Components: Konsta UI first, Tailwind second

1. **Konsta UI** (`konsta/svelte`) — the default for everything it has: `Page`, `Navbar`,
   `Block`, `List`/`ListItem`, `Button`, `Dialog`, `Popup`, `Sheet`, `Actions`, `Panel`, `Toast`,
   `Radio`/`Toggle`, `Tabbar`. Both platforms use the **iOS** theme
   (`<App safeAreas theme="ios">` in `App.svelte`).
2. **Tailwind 4** — when Konsta has no such component or a non-standard look is needed. Also for
   spacing and layout around Konsta components and for adjusting them through `class`.
3. **A `<style>` block in the component** — only for what utilities express badly: complex
   layouts, animations, the splash, the onboarding.

Don't wrap a Konsta component in your own just to restyle it, and don't rewrite it in Tailwind.
Use its props, `class` and `colors` first.

```svelte
<script>
  import { Block, Button } from "konsta/svelte";
</script>

<Block strong inset class="flex flex-col gap-4">
  <Button large rounded class="bg-brand-primary">{$i18n.t("ui:map:mapEditor:save")}</Button>
</Block>
```

## Theme and tokens

- Brand colors — the `@theme` block in `src/App.css`: `--color-brand-primary`,
  `--color-brand-primary-dark`, `--color-brand-blue`, `--color-brand-green`. They become the
  utilities `bg-brand-primary`, `text-brand-blue`. **New tokens go here.**
- `tailwind.config.js` remaps `black`/`white` to `stone-800`/`stone-100` app-wide. The values
  there are literal (`colors.stone[800]`). Writing `var(--color-black)` would reference itself
  and break opacity modifiers.
- In plain CSS a color from the JS config is read with `--theme()`:
  `--k-color-text: --theme(--color-black)`. There is no `--color-black` variable.
- Tailwind 4 emits colors in `oklch` with no hex fallback. Minimum versions: Android System
  WebView / Chrome 111+, iOS Safari 16.4+.
- Third-party CSS (`maplibre-gl`, `swiper`) is imported once, in `src/App.css`. Styles for what
  MapLibre draws on the map (popups, markers, attribution) are in
  `src/assets/styles/maplibre.css`. Typography — `src/assets/styles/typography.css`.

## Dark theme

`lib/theme/themeManager.js` puts the `dark` class on `<html>`. Both Konsta and Tailwind's `dark:`
use it. The switch is `components/Preferences/DarkModeToggler.svelte`.

```svelte
<p class="text-stone-700 dark:text-stone-200">...</p>
```

The map has its own dark style (`views/Map/Session/MapTheme.svelte.js` + `services/mapStyle.js`):
a CSS class doesn't repaint the MapLibre canvas. Every new element is checked in both themes. A
literal hex is fine only as a deliberate brand color, the same in both themes.

## Translations (i18next)

Four locales: `ru` (primary), `en`, `pl`, `uz`. Any visible text, including `aria-label`s,
placeholders and toasts, goes through i18next and is added to all four locales in the same change.

```
locales/
├── resources.js        gathers all languages for i18next
├── collections.js      code → language name for the switcher
└── {ru,en,pl,uz}/
    ├── index.js        exports the namespaces
    ├── ui.js           interface: buttons, titles, hints, aria-labels
    ├── errors.js       toast and error texts
    ├── articles.js     historical-place articles by id
    └── about.js        the About screen's text
```

Components receive `i18n` as a prop and take text through `$i18n.t`:

```svelte
<script>
  let { i18n } = $props();
</script>

<span>{$i18n.t("ui:map:mapEditor:photosAdd")}</span>
<span>{$i18n.t("ui:map:mapEditor:photosCount", { count: photos.length, max: LIMITS.maxPhotos })}</span>
```

- Keys are nested by feature and component (`ui:map:mapEditor:photosAdd`), not kept as a flat
  list.
- Interpolation uses `{{name}}`; placeholder names are the same in all locales.
- A long string is wrapped like this (an example from `locales/en/ui.js`):

```js
photosHint:
  'Up to {{max}} photos. The first photo becomes the cover of the marker.',
```

- Changing the language: `$i18n.changeLanguage(code)` (`components/Preferences/LangSwitcher.svelte`).
  The choice is stored in Preferences under the `locale` key. On first launch the language comes
  from the device (`@capacitor/device`). The fallback language is `en`.
- The strings in `about.js` and the article descriptions contain HTML on purpose. The markup is
  the same in all locales and is rendered with `{@html}`. The ESLint rule is switched off only on
  that line, with the reason:

```svelte
<!-- eslint-disable-next-line svelte/no-at-html-tags -- markup from our own locale files -->
{@html $i18n.t("about:shortInfo")}
```

  User text (markers) is never rendered with `{@html}`. `components/Article.svelte` tells the
  sources apart by the `isHtml` flag: articles are rendered as HTML, markers as plain text.

Parity is checked by `src/locales/resources.test.js`: every locale has exactly `ru`'s keys, the
same `{{placeholders}}` and the same HTML tags in each string (`<br>` excepted). A missing key
would silently show English at runtime; the test catches it.

A new language is a product decision: a new folder, entries in `resources.js` and
`collections.js`, translated articles and `about`.
