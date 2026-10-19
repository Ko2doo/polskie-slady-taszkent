# State

New state is written with Svelte 5 runes (`$state`, `$derived`, `$effect`). Modules with runes
are named `*.svelte.js` and live in `lib/state/`. Classic stores (`writable`) remain only in
`store/` and a few older modules. New ones are not allowed, ESLint checks it.

## What to pick

| Need | Solution | Example |
| --- | --- | --- |
| State of one component | Local `$state` in the component | Almost everything |
| The same shape, but each consumer gets its own instance | A `createX()` factory in a `.svelte.js` file | `createToggle`, `createPhotoSession`, `createEditModeController` |
| The very same object for different screens | A module-level singleton | `customPointsState`, `articlePopupState` |
| The store contract is needed (`$store` in markup) | An existing store | `$i18n` (`store/i18nextSvelte/`) |

A typical factory: a function with `$state` inside, values exposed through `get`.

```js
// lib/state/createToggler.svelte.js
export function createToggle(initial = false) {
  let open = $state(initial);

  return {
    get value() {
      return open;
    },

    open() {
      open = true;
    },

    close() {
      open = false;
    },

    toggle() {
      open = !open;
    },

    set(v) {
      open = !!v;
    },
  };
}
```

## UI profiles: navbar, panel, tab bar

`createUIProfile(defaults)` (`lib/state/createUIProfile.svelte.js`) is a flat reactive object of
UI fields with these methods:

- `set(cfg)` — replace it whole (fields are merged over `defaults`);
- `patch(obj)` — update it partially;
- `reset()` — go back to `defaults`;
- `withProfile(cfg)` — `set` plus returning the `reset` function, to hand it back from `$effect`.

Built on it:

| Module | Fields | API |
| --- | --- | --- |
| `navbar.svelte.js` | `title`, `leftSnippet`, `rightSnippet`, `subnavSnippet` | `setNavbar`, `patchNavbar`, `resetNavbar`, `withNavbar` |
| `panel.svelte.js` | `isOpen`, `side`, `backdrop`, `floating`, `title`, `contentSnippet` | `setPanel`, `patchPanel`, `openPanel`, `closePanel`, `resetPanel`, `withPanel` |
| `bottomTabbarNav.svelte.js` | the slide animation `{ duration, delay }` | `hideTabbar(slide)`, `resetTabbar` |

```js
$effect(() => withNavbar({ title: $i18n.t('ui:navbar:settings:title'), leftSnippet: BackButton }));
```

The tab bar's visibility isn't a profile field but a **count of hide requests**. `hideTabbar()`
returns a function that releases the request, and the tab bar is visible while no request is
left. That way the result doesn't depend on the order screens mount in.

```js
$effect(() => hideTabbar(QUICK_TABBAR_SLIDE));

$effect(() => {
  if (isEditMode) return hideTabbar(QUICK_TABBAR_SLIDE);
});
```

A new shared piece of chrome with an "open / configure / reset" shape is built as a
specialization of `createUIProfile`, not as a new state shape.

## Toggles, overlays, the Android Back button

The hardware Back button is handled in `capacitor/backButton.js` (`initBackButtonHandler()`,
Android only). The order:

1. Close the top overlay of the `store/ui/overlayController.js` stack (LIFO).
2. If there's history, run `routerBack('/')`.
3. Not on the home screen — go to `/`.
4. On the home screen, the first press shows a "press again to exit" toast
   (`services/toastController.js`), a second press within the window minimizes the app.

How to hook your overlay up to the Back button:

| Situation | Tool |
| --- | --- |
| A plain toggle with nothing to do with Back | `createToggle()` (`lib/state/createToggler.svelte.js`) |
| A modal that closes on Back | `createToggleOverlay()` (`lib/state/createToggleOverlay.js`) |
| The open state comes from outside (a prop, shared state) | `useOverlay(onClose)` (`services/useOverlay.js`) or `overlayController.register/unregister` in an `$effect` |

```js
import { createToggleOverlay } from '@/lib/state/createToggleOverlay';

const viewer = createToggleOverlay();
viewer.open();

$effect(() => () => viewer.close());
```

The last line is required. If the screen is left some other way than Back — a link — with the
overlay open, a dead entry stays on the stack: the toggle has no lifecycle of its own.

```js
import { useOverlay } from '@/services/useOverlay';

const { open, close } = useOverlay(() => (opened = false));

function openModal() {
  opened = true;
  open();
}
```

The one who opens owns the toggle. The opened component stays presentational, driven by props:
`PhotoSlider.svelte` owns the toggle, `PhotoViewer.svelte` gets `opened`.

On the Back stack today: the side panel, the marker editor, the article popup, the photo viewer,
the import confirmation. Deliberately not on it: the first-launch wizard (it can't be closed
mid-flow) and `NavigationSheet`.

## Feature modules

| Module | What it holds |
| --- | --- |
| `customPointsState.svelte.js` | User markers, see [Custom markers](05-custom-markers.md) |
| `photoSession.svelte.js` | Photos of one open form |
| `article.svelte.js` — `articlePopupState` | The open article: `id`, `isOpen`, `open(id)`, `close()`. One popup for the whole app |
| `mapMarkerFilter.svelte.js` — `mapMarkerFilter` | The `all / custom / historical` marker filter, stored in Preferences |
| `customPointsDialogState.svelte.js` | Whether the user has seen the markers intro dialog |

```js
import { articlePopupState } from '@/lib/state/article.svelte';

articlePopupState.open('l03');
```

## Stores (`store/`)

The existing stores work and aren't rewritten for the sake of modernizing:

| Store | Purpose |
| --- | --- |
| `ui/errorToast.js` — `errorToast` | The single channel for errors, warnings and info to the user: queue, dedup, rate limit |
| `ui/toastInput.js` | Normalizes a toast's input: a string, an `Error` or a plugin object → text, kind, meta |
| `ui/overlayController.js` | The overlay stack for the Back button |
| `ui/layoutView.js` | The Handbook list layout (grid/list) |
| `i18nextSvelte/` | `$i18n` for markup |
| `appStartInitialize.js` | The first-launch flag |

```js
import { errorToast } from '@/store/ui/errorToast';

errorToast.error(text, { scope: 'Storage', code });
errorToast.warn(text);
errorToast.info(text);
errorToast.hide();
errorToast.clear();
```

Instead of "Close", a toast can carry an action button:
`action: { type: 'openSettings', label, handler: openAppSettings }`. The rate limit is counted by
`utils/rateLimiter.js`, outside the reactive store, so the bookkeeping causes no extra re-renders.

`services/toastController.js` is not `errorToast` but a separate "press again to exit" toast with
a countdown.

## Theme (`lib/theme/themeManager.js`)

`getThemeManager()` is a plain-JS singleton with its own `subscribe` (no runes). Modes: "follow the
system" (nothing stored, tracks `prefers-color-scheme`) or manual `ui.theme = 'dark' | 'light'` in
Preferences. It toggles the `dark` class on `<html>`, which Konsta and Tailwind's `dark:` key off.
Initialized in `main.js` before mounting.
