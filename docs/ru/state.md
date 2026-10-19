# Состояние

Новое состояние пишется на рунах Svelte 5 (`$state`, `$derived`, `$effect`). Модули с рунами
называются `*.svelte.js` и лежат в `lib/state/`. Классические сторы (`writable`) остались
только в `store/` и в нескольких старых модулях. Новые запрещены, это проверяет ESLint.

## Что выбрать

| Нужно | Решение | Пример |
| --- | --- | --- |
| Состояние одного компонента | Локальный `$state` в компоненте | Почти всё |
| Одинаковая форма, но у каждого потребителя свой экземпляр | Фабрика `createX()` в `.svelte.js` | `createToggle`, `createPhotoSession`, `createEditModeController` |
| Один и тот же объект для разных экранов | Модульный синглтон | `customPointsState`, `articlePopupState` |
| Нужен контракт стора (`$store` в разметке) | Существующий стор | `$i18n` (`store/i18nextSvelte/`) |

Типичная фабрика: функция с `$state` внутри, наружу значения отдаются через `get`.

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

## UI-профили: навбар, панель, таббар

`createUIProfile(defaults)` (`lib/state/createUIProfile.svelte.js`) — плоский реактивный объект
полей интерфейса с методами:

- `set(cfg)` — заменить целиком (поля сливаются с `defaults`);
- `patch(obj)` — частично обновить;
- `reset()` — вернуть `defaults`;
- `withProfile(cfg)` — `set` плюс возврат функции `reset`, чтобы отдать её из `$effect`.

На нём построены:

| Модуль | Поля | API |
| --- | --- | --- |
| `navbar.svelte.js` | `title`, `leftSnippet`, `rightSnippet`, `subnavSnippet` | `setNavbar`, `patchNavbar`, `resetNavbar`, `withNavbar` |
| `panel.svelte.js` | `isOpen`, `side`, `backdrop`, `floating`, `title`, `contentSnippet` | `setPanel`, `patchPanel`, `openPanel`, `closePanel`, `resetPanel`, `withPanel` |
| `bottomTabbarNav.svelte.js` | анимация `{ duration, delay }` | `hideTabbar(slide)`, `resetTabbar` |

```js
$effect(() => withNavbar({ title: $i18n.t('ui:navbar:settings:title'), leftSnippet: BackButton }));
```

Видимость таббара — не поле профиля, а **счётчик запросов на скрытие**. `hideTabbar()`
возвращает функцию снятия запроса, и таббар виден, пока не осталось ни одного запроса. Так
результат не зависит от порядка, в котором экраны монтируются.

```js
$effect(() => hideTabbar(QUICK_TABBAR_SLIDE));

$effect(() => {
  if (isEditMode) return hideTabbar(QUICK_TABBAR_SLIDE);
});
```

Новый общий элемент интерфейса с формой «открыть / настроить / сбросить» делается
специализацией `createUIProfile`, а не новой формой состояния.

## Тогглы, оверлеи, кнопка «Назад» Android

Аппаратная кнопка «Назад» обрабатывается в `capacitor/backButton.js` (`initBackButtonHandler()`,
только Android). Порядок:

1. Закрыть верхний оверлей из стека `store/ui/overlayController.js` (LIFO).
2. Если есть история, выполнить `routerBack('/')`.
3. Не на главной — перейти на `/`.
4. На главной первое нажатие показывает тост «нажмите ещё раз для выхода»
   (`services/toastController.js`), второе в течение окна сворачивает приложение.

Как подключить свой оверлей к кнопке «Назад»:

| Ситуация | Инструмент |
| --- | --- |
| Простой тоггл без связи с «Назад» | `createToggle()` (`lib/state/createToggler.svelte.js`) |
| Модалка, которая закрывается по «Назад» | `createToggleOverlay()` (`lib/state/createToggleOverlay.js`) |
| Открытие задаётся извне (prop, общее состояние) | `useOverlay(onClose)` (`services/useOverlay.js`) или `overlayController.register/unregister` в `$effect` |

```js
import { createToggleOverlay } from '@/lib/state/createToggleOverlay';

const viewer = createToggleOverlay();
viewer.open();

$effect(() => () => viewer.close());
```

Последняя строка обязательна. Если уйти с экрана не через «Назад», а по ссылке, при открытом
оверлее, в стеке останется мёртвая запись: у тоггла нет своего жизненного цикла.

```js
import { useOverlay } from '@/services/useOverlay';

const { open, close } = useOverlay(() => (opened = false));

function openModal() {
  opened = true;
  open();
}
```

Владеет тогглом тот, кто открывает. Открываемый компонент остаётся презентационным, на
пропсах: `PhotoSlider.svelte` владеет тогглом, `PhotoViewer.svelte` получает `opened`.

В стеке «Назад» сейчас: боковая панель, редактор меток, попап статьи, просмотр фото,
подтверждение импорта. Намеренно не в стеке: мастер первого запуска (его нельзя закрыть
посреди шагов) и `NavigationSheet`.

## Модули фич

| Модуль | Что хранит |
| --- | --- |
| `customPointsState.svelte.js` | Пользовательские метки, см. [Пользовательские метки](custom-markers.md) |
| `photoSession.svelte.js` | Фото одной открытой формы |
| `article.svelte.js` — `articlePopupState` | Открытая статья: `id`, `isOpen`, `open(id)`, `close()`. Один попап на всё приложение |
| `mapMarkerFilter.svelte.js` — `mapMarkerFilter` | Фильтр меток `all / custom / historical`, хранится в Preferences |
| `customPointsDialogState.svelte.js` | Видел ли пользователь вводный диалог про метки |

```js
import { articlePopupState } from '@/lib/state/article.svelte';

articlePopupState.open('l03');
```

## Сторы (`store/`)

Существующие сторы работают и не переписываются ради модернизации:

| Стор | Назначение |
| --- | --- |
| `ui/errorToast.js` — `errorToast` | Единственный канал ошибок, предупреждений и инфо для пользователя: очередь, дедупликация, лимит частоты |
| `ui/toastInput.js` | Нормализация входа тоста: строка, `Error` или объект плагина → текст, вид, meta |
| `ui/overlayController.js` | Стек оверлеев для кнопки «Назад» |
| `ui/layoutView.js` | Вид списка в Handbook (сетка/список) |
| `i18nextSvelte/` | `$i18n` для разметки |
| `appStartInitialize.js` | Флаг первого запуска |

```js
import { errorToast } from '@/store/ui/errorToast';

errorToast.error(text, { scope: 'Storage', code });
errorToast.warn(text);
errorToast.info(text);
errorToast.hide();
errorToast.clear();
```

Вместо кнопки «Закрыть» у тоста может быть кнопка действия:
`action: { type: 'openSettings', label, handler: openAppSettings }`. Лимит частоты считает
`utils/rateLimiter.js`, вне реактивного стора, чтобы учёт не вызывал лишних перерисовок.

`services/toastController.js` — это не `errorToast`, а отдельный тост «нажмите ещё раз для
выхода» с обратным отсчётом.

## Тема (`lib/theme/themeManager.js`)

`getThemeManager()` — синглтон на чистом JS со своим `subscribe` (без рун). Режимы: «как в
системе» (значения нет, следит за `prefers-color-scheme`) или вручную `ui.theme = 'dark' | 'light'`
в Preferences. Переключает класс `dark` на `<html>`, от него работают Konsta и `dark:` в
Tailwind. Инициализируется в `main.js` до монтирования.
