# Architecture

## Context

An offline app for a single user, with no backend. The map, the road graph and the articles
ship inside the build (`public/`); user data lives in files on the device. No network requests
leave the device. There is no auth, sync or concurrent writes to handle. What matters instead:
no data loss when the app crashes, no breakage on a full disk, no lag on a weak Android phone.

Stack: Svelte 5 (runes), Vite, Konsta UI + Tailwind 4, MapLibre GL + PMTiles, Capacitor 8,
i18next. Exact versions are in `package.json`.

## Startup

```
index.html → src/main.js → App.svelte → router → screen
```

`main.js`:

1. `getThemeManager().init()` applies the theme before the first paint, so there is no flash
   of the light theme.
2. `resolveAppInfo()` gets the name and version: from `App.getInfo()` on a device, from the
   build globals `__APP_NAME__`/`__APP_VERSION__` on the web.
3. `mount(App, { props: { version, appName, appLogo } })`.
4. `SplashScreen.hide()` runs in `finally`. `capacitor.config.json` sets
   `launchAutoHide: false`, so this is the only place the splash is hidden.

A failure in any step doesn't stop the startup: the default value is used.

`App.svelte` is the app shell:

- Konsta `App`/`Page`/`Navbar`/`Panel`, the bottom tab bar, the router outlet.
- `AppSplash.svelte` is shown until `onMount` finishes, i.e. until `APP_READY`.
- In `onMount`, in order: `initFirstLaunch()`, `initBackButtonHandler()`,
  `initCustomPointsPersistence()`.
- Global overlays: the first-launch wizard (`views/OnboardingWizard/`) and the article popup
  (`components/Article.svelte`).
- Shows marker storage problems (`customPointsState.takeNotices()`) as toasts.

Routes: `src/Routes.js`, library `@mateothegreat/svelte5-router`. More in [Screens](screens.md).

## `src/` directories

| Directory | Contents | Rule |
| --- | --- | --- |
| `capacitor/` | Native plugin wrappers | One file — one plugin. Other code never imports plugins directly |
| `components/` | Reusable components by feature | A component shared by several features sits at the root of `components/` |
| `data/` | Static content: articles, metadata | No logic |
| `lib/errors/` | `errorCodes.js` | The only place for error-code strings |
| `lib/icons/` | SVG icons as components | Check for an existing one before adding |
| `lib/state/` | Reactive state on runes (`*.svelte.js`) | See [State](state.md) |
| `lib/theme/` | `themeManager.js` — light/dark theme | A plain-JS singleton |
| `locales/` | Translations `ru`, `en`, `pl`, `uz` | The same keys in all four |
| `services/` | Business logic without UI and without direct plugin calls | File format, storage, A\*, map builders |
| `store/` | Classic Svelte stores | No new ones, only the existing ones |
| `test/` | Test helpers | Never imported by app code |
| `utils/` | Small pure functions, no runes, no dependencies | |
| `views/` | Screens, one folder per screen | `views/Map/` is split into `Session/`, `Points/`, `Navigation/` |

### Where new code goes

1. A component with markup → `components/<Feature>/`; a screen → `views/<Screen>/`.
2. Reactive state shared by several components → `lib/state/<name>.svelte.js`.
3. A new native plugin → a new file in `capacitor/services/` or `capacitor/utils/`.
4. Logic without UI → `services/`.
5. A small pure function → `utils/`.
6. A test → next to its module: `<module>.js` → `<module>.test.js`.

When a folder collects modules about different concerns, they are moved into subfolders named
after their contents (`Navigation/`, `GPS/`, `Photos/`). Names like `helpers`, `utils` or
`misc` aren't used for such subfolders.

### Import boundaries (checked by ESLint)

```js
// services/myFeature.js
import { Preferences } from '@capacitor/preferences';
import { writable } from 'svelte/store';

// correct:
import { getStorage, setStorage } from '@/capacitor/utils/appStorage';
import { Capacitor } from '@capacitor/core';
```

The first two lines fail with `no-restricted-imports`. `@capacitor/*` plugins (except
`@capacitor/core`) are imported only in `capacitor/` and `main.js`. `writable`/`readable`/`derived`
are allowed only in the old stores listed in `eslint.config.js` (`STORE_FACTORY_EXCEPTIONS`).
Reading a store with `get` is fine anywhere.

## Errors

The user sees an error through one channel only — `store/ui/errorToast.js`. Error codes live
only in `lib/errors/errorCodes.js`:

- `OS_PLUG_<PLUGIN>_<NNNN>` — Capacitor plugin codes (geolocation, files, camera) with a link to
  the plugin's docs.
- `<DOMAIN>_<WHAT>` — the app's own failures: `NAV_ROUTE_NOT_FOUND`, `MAP_INIT_FAILED`,
  `POINTS_IMPORT_REFUSED`.

```js
import { ERROR_CODES } from '@/lib/errors/errorCodes';
import { errorToast } from '@/store/ui/errorToast';

errorToast.error(i18n.t('errors:mapInitFailed'), { scope: 'Map', code: ERROR_CODES.MAP_INIT_FAILED });
```

A line like `error.code === 'OS-PLUG-FILE-0008'` is not allowed in code; the
`lib/errors/errorCodes.test.js` test looks for such literals. A new error code goes into
`errorCodes.js`, and its text into `locales/*/errors.js` of all four languages.

## Logging

`console.*` is not allowed in app code (ESLint). Use the logger instead:

```js
import { createLogger, IS_DEBUG } from '@/utils/debugMode';

const storageLogger = createLogger('CustomPointsStorage');

IS_DEBUG && storageLogger.error('Slot write failed:', error);
```

`IS_DEBUG` is `import.meta.env.DEV`. In a production build the call doesn't run at all, and
neither are its arguments evaluated. A caught and swallowed error must leave at least a debug log.

## Performance

The app targets weak Android phones:

- The JS ↔ native bridge is expensive. A photo is copied natively (`Filesystem.copy`), not
  through base64. The data directory's URI is requested once and cached (`getDataDirectoryUri()`).
- Images are downscaled by the Camera plugin itself: long side 1280, quality 80. The canvas
  resize (`utils/imageResize.js`) is used only in the web build.
- Anything that creates a resource (a Blob url, a listener, a timer, a native listener) is
  released in an `$effect` cleanup or by an explicit `release()`/`dispose()`.
- Heavy things are loaded lazily. Third-party CSS is imported once, in `src/App.css`.
- The `.pmtiles` archive is held in memory whole. This is deliberate: Capacitor's local server
  doesn't support Range requests. More in [Map data](map-data.md).
