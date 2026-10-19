# Screens

## Routes (`src/Routes.js`)

| Path | Component | Tab bar | What it does |
| --- | --- | --- | --- |
| `/` | `views/Map/Map.svelte` | yes | The map: historical places, user markers, navigation. See [Map screen](map-screen.md) |
| `/handbook` | `views/Handbook/Handbook.svelte` | yes | List of places: grid/list, category filter, search |
| `/more` | `views/More/More.svelte` | yes | Menu: Settings, About, Technical info |
| `/settings` | `views/Settings/Settings.svelte` | no | Language, theme, marker export/import, OS permissions |
| `/about` | `views/About/About.svelte` | no | About the project, text from `about:fullInfo` |
| `/technical-info` | `views/TechnicalInfo/TechnicalInfo.svelte` | no | Technologies used, data from `data/about.js` |

Not routes but overlays rendered by `App.svelte`:

- `views/OnboardingWizard/OnboardingWizard.svelte` — the first-launch wizard: location
  permission, language, theme. The "done" flag lives in `store/appStartInitialize.js`. The
  Android Back button doesn't close it, by design.
- `components/Article.svelte` — the article popup, one for the whole app. Opened from
  `Handbook` and from a marker popup on the map through `articlePopupState`
  (`lib/state/article.svelte.js`). Shows both historical places and user markers.

## The screen pattern

Every screen receives `{ route, i18n }` props and configures the shared chrome in an `$effect`:
the navbar (`withNavbar`) and, if the screen has no tab bar, `hideTabbar`. Both return an undo
function that **must** be returned from the `$effect`: that's what restores the chrome when the
screen is left.

```svelte
<script>
  import { Block, NavbarBackLink } from "konsta/svelte";

  import { resolvePageKeyFromRouteResult } from "@/utils/routerUtils";
  import { withNavbar } from "@/lib/state/navbar.svelte";
  import { hideTabbar, QUICK_TABBAR_SLIDE } from "@/lib/state/bottomTabbarNav.svelte";
  import { routerBack } from "@/services/navigationHistoryHook";

  let { route, i18n } = $props();

  $effect(() => {
    const pageKey = resolvePageKeyFromRouteResult(route?.result);

    // the navbar's undo is returned from the effect
    return withNavbar({
      title: $i18n.t(`ui:navbar:${pageKey}:title`),
      leftSnippet: BackButton,
    });
  });

  // a screen without the tab bar; the request is released when the screen is left
  $effect(() => hideTabbar(QUICK_TABBAR_SLIDE));
</script>

{#snippet BackButton()}
  <NavbarBackLink onClick={() => routerBack("/more")} aria-label={$i18n.t("ui:buttons:back")} />
{/snippet}

<Block strong inset>...</Block>
```

- `resolvePageKeyFromRouteResult(route.result)` (`utils/routerUtils.js`) turns the path into a
  page key (`/about` → `about`) for translations and navbar logic. If no key is needed, the title
  can be set directly, as `TechnicalInfo.svelte` does:
  `$i18n.t("ui:navbar:technicalInfo:title")`.
- Back goes through `routerBack(fallback)` (`services/navigationHistoryHook.js`), not the router
  directly: that way the navbar button and the Android hardware button share one history.
  `fallback` is the parent screen. It's needed after a reload, when the in-memory history is empty.
- Forward navigation (the `More` menu) uses the router's `goto()`.
- The tab bar is visible as long as nobody hides it. `hideTabbar` counts hide requests, so the
  order in which screens mount and unmount doesn't matter.

## Adding a screen

1. Create `views/<Name>/<Name>.svelte` following the pattern above.
2. Add `{ path: '/<name>', component: <Name> }` to `src/Routes.js`.
3. If you need a page key, add a `case` to `resolvePageKeyFromRouteResult`.
4. Add the `ui:navbar:<key>:title` keys to all four `locales/*/ui.js`.
5. Add a link where the screen is opened from (`views/More/More.svelte` or the tab bar
   `components/BottomTabbarNav.svelte`).
6. If the screen has logic, write `views/<Name>/<Name>.test.js`. Examples:
   `views/Settings/Settings.test.js`, `views/About/About.test.js`.

## Settings

The sections sit in one `Block`, separated by dividers: language, appearance, "My markers"
(`components/CustomPoints/CustomPointsTransfer.svelte`), OS permissions (`openAppSettings()`).
**Permissions always come last**: a new section goes before them. `Settings.test.js` checks the
order.

## Handbook

Data: `articlesMeta` from `data/articles.js`; texts: the `articles` namespace in the locales.

- Layout switch: `components/Filters/LayoutSwitcher.svelte`, the choice is remembered in
  `store/ui/layoutView.js`.
- Category filter: `components/Filters/SortingByCategories.svelte`.
- Search: `components/SearchBar.svelte`.
- Tapping a card calls `articlePopupState`, which opens the same article popup as on the map.
