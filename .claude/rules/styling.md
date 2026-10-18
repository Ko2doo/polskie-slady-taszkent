---
paths:
  - "src/**/*.svelte"
  - "src/**/*.css"
  - "tailwind.config.js"
  - "src/lib/theme/**"
  - "src/services/mapStyle.js"
  - "src/views/Map/MapTheme.svelte.js"
---

# Styling and UI components (Konsta UI first, Tailwind second)

## The order of preference

1. **A Konsta UI component** (`konsta/svelte`) — the default for anything Konsta already
   provides: `Page`, `Navbar`, `Block`, `List`/`ListItem`, `Button`, `Dialog`, `Popup`,
   `Sheet`, `Actions`, `Panel`, `Toast`, `Radio`/`Toggle`, `Tabbar`, etc. The app is a
   native-looking mobile app; Konsta is what makes it look and behave consistently (iOS
   theme, safe areas, dark mode). Check Konsta's component list before building something
   by hand.
2. **Tailwind utility classes** — when Konsta has no component for it, or when the design
   is deliberately non-standard (something that isn't meant to look like a stock Konsta
   control). Also fine for layout/spacing around Konsta components and for passing
   `class="..."` into a Konsta component to adjust it.
3. **A scoped `<style>` block in the component** — only for things utilities express
   badly (complex layouts, animations, splash/onboarding screens). A handful of components
   do this today (`AppSplash.svelte`, `App.svelte`, `OnboardingWizard.svelte`,
   `Map.svelte`, `NavigationModeSelection.svelte`); keep it the exception.

Don't wrap a Konsta component in a custom one just to restyle it, and don't re-implement a
Konsta control with Tailwind because it's slightly easier to tweak — extend it via its
props/`class`/`colors` first.

## How it's wired

- Tailwind **4** via `@tailwindcss/vite` (`vite.config.js`). Two places hold theme config:
  - `src/App.css`'s `@theme { ... }` block — the brand tokens (`--color-brand-primary`,
    `--color-brand-primary-dark`, `--color-brand-blue`, `--color-brand-green`), which become
    utilities (`bg-brand-primary`, `text-brand-blue`, ...). **New design tokens go here.**
  - `tailwind.config.js`, loaded via `@config '../tailwind.config.js'` in `App.css` —
    remaps `black`/`white` to `stone-800`/`stone-100` app-wide (so `bg-black/50`,
    `dark:text-white`, and Konsta's own black/white classes all use the soft shades).
    Values there must be literal colors (`colors.stone[800]` from `tailwindcss/colors`), never
    `var(--color-black)`: a self-referencing var breaks opacity modifiers.
  - A JS-config color is inlined into utilities and does **not** produce a
    `--color-black` CSS variable, so plain CSS reads it with Tailwind's `--theme()`
    function: `--k-color-text: --theme(--color-black)` in `App.css`, not
    `var(--color-black)` (that would be undefined).
  - Tailwind 4 emits `oklch`/`oklab` colors with no hex fallback — the effective floor is
    Android System WebView / Chrome 111+, iOS Safari 16.4+.
- Konsta's theme CSS is imported once in `App.css` (`konsta/svelte/theme.css`), and its
  colors are driven by `--k-color-*` CSS variables set in `:root` / `.dark` there. See
  `konstaui.com/svelte/colors`.
- `App.svelte` renders `<App safeAreas theme="ios">` — the app uses Konsta's **iOS theme on
  both platforms**. Don't introduce Material-theme components or `theme="material"` without
  asking.
- Third-party CSS (`maplibre-gl`, `swiper`) is imported once in `App.css` — see
  `harness/performance.md`. Global typography is in `src/assets/styles/typography.css`.

## Dark mode

- `src/lib/theme/themeManager.js` — `getThemeManager()`, a plain-JS module singleton
  (pre-runes style, with its own `subscribe`): either "follow system" (no stored value,
  tracks `prefers-color-scheme`) or a manual `ui.theme = 'dark' | 'light'` persisted via
  `capacitor/utils/appStorage.js`. It toggles the `dark` class on `<html>`, which both
  Konsta and Tailwind's `dark:` variant key off. Initialized once in `main.js` before mount;
  `DarkModeToggler.svelte` is the UI for it.
- The map has its own light/dark *style* (`views/Map/MapTheme.svelte.js` +
  `services/mapStyle.js`) driven by the same theme state — a CSS dark class alone doesn't
  restyle a MapLibre canvas.
- Every new UI piece must look right in both themes. Prefer Konsta components and
  `dark:` utilities over hardcoded colors; a literal hex color in a component should be a
  deliberate, theme-independent brand color.
