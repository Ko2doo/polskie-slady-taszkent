# Экраны

## Маршруты (`src/Routes.js`)

| Путь | Компонент | Таббар | Что делает |
| --- | --- | --- | --- |
| `/` | `views/Map/Map.svelte` | да | Карта: исторические места, свои метки, навигация. См. [Экран карты](04-map-screen.md) |
| `/handbook` | `views/Handbook/Handbook.svelte` | да | Список мест: сетка/список, фильтр по категориям, поиск |
| `/more` | `views/More/More.svelte` | да | Меню: Настройки, О приложении, Техническая информация |
| `/settings` | `views/Settings/Settings.svelte` | нет | Язык, тема, экспорт/импорт меток, системные разрешения |
| `/about` | `views/About/About.svelte` | нет | О проекте, текст из `about:fullInfo` |
| `/technical-info` | `views/TechnicalInfo/TechnicalInfo.svelte` | нет | Используемые технологии, данные из `data/about.js` |

Не маршруты, а оверлеи из `App.svelte`:

- `views/OnboardingWizard/OnboardingWizard.svelte` — мастер первого запуска: разрешение
  на геолокацию, язык, тема. Флаг «пройден» хранится в `store/appStartInitialize.js`.
  Кнопкой «Назад» Android он не закрывается, так задумано.
- `components/Article.svelte` — попап статьи, один на всё приложение. Открывается из
  `Handbook` и из попапа маркера на карте через `articlePopupState`
  (`lib/state/article.svelte.js`). Показывает и исторические места, и свои метки.

## Шаблон экрана

Каждый экран получает пропсы `{ route, i18n }` и в `$effect` настраивает общий интерфейс:
навбар (`withNavbar`) и, если таббар экрану не нужен, `hideTabbar`. Обе функции возвращают
функцию отката, и её **обязательно** нужно вернуть из `$effect`: тогда интерфейс
восстанавливается при уходе с экрана.

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

    // откат навбара возвращается из эффекта
    return withNavbar({
      title: $i18n.t(`ui:navbar:${pageKey}:title`),
      leftSnippet: BackButton,
    });
  });

  // экран без таббара; запрос снимается при уходе с экрана
  $effect(() => hideTabbar(QUICK_TABBAR_SLIDE));
</script>

{#snippet BackButton()}
  <NavbarBackLink onClick={() => routerBack("/more")} aria-label={$i18n.t("ui:buttons:back")} />
{/snippet}

<Block strong inset>...</Block>
```

- `resolvePageKeyFromRouteResult(route.result)` (`utils/routerUtils.js`) превращает путь в
  ключ страницы (`/about` → `about`) для переводов и логики навбара. Если ключ не нужен,
  заголовок можно задать напрямую, как в `TechnicalInfo.svelte`:
  `$i18n.t("ui:navbar:technicalInfo:title")`.
- «Назад» делается через `routerBack(fallback)` (`services/navigationHistoryHook.js`), а не
  через роутер напрямую: так кнопка в навбаре и аппаратная кнопка Android используют одну
  историю. `fallback` — родительский экран. Он нужен после перезагрузки, когда история в
  памяти пуста.
- Переходы вперёд (меню `More`) идут через `goto()` из роутера.
- Таббар виден, пока его никто не скрыл. `hideTabbar` считает запросы на скрытие, поэтому
  порядок, в котором экраны монтируются и размонтируются, ни на что не влияет.

## Как добавить экран

1. Создайте `views/<Name>/<Name>.svelte` по шаблону выше.
2. Добавьте `{ path: '/<name>', component: <Name> }` в `src/Routes.js`.
3. Если нужен ключ страницы, добавьте `case` в `resolvePageKeyFromRouteResult`.
4. Добавьте ключи `ui:navbar:<key>:title` во все четыре `locales/*/ui.js`.
5. Добавьте ссылку туда, откуда экран открывается (`views/More/More.svelte` или таббар
   `components/BottomTabbarNav.svelte`).
6. Если у экрана есть логика, напишите `views/<Name>/<Name>.test.js`. Примеры:
   `views/Settings/Settings.test.js`, `views/About/About.test.js`.

## Settings

Секции идут в одном `Block` через разделители: язык, оформление, «Мои метки»
(`components/CustomPoints/CustomPointsTransfer.svelte`), разрешения ОС
(`openAppSettings()`). **Разрешения всегда идут последними**: новая секция вставляется перед
ними. Порядок проверяет `Settings.test.js`.

## Handbook

Данные — `articlesMeta` из `data/articles.js`, тексты — пространство имён `articles` в локалях.

- Переключатель вида: `components/Filters/LayoutSwitcher.svelte`, выбор запоминается в
  `store/ui/layoutView.js`.
- Фильтр по категориям: `components/Filters/SortingByCategories.svelte`.
- Поиск: `components/SearchBar.svelte`.
- Нажатие на карточку вызывает `articlePopupState`, и открывается тот же попап статьи, что
  и на карте.
