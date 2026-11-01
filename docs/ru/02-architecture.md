# Архитектура

## Контекст

Офлайн-приложение для одного пользователя, без бэкенда. Карта, граф дорог и статьи лежат
внутри сборки (`public/`), пользовательские данные хранятся в файлах на устройстве. Сетевых
запросов наружу нет. Здесь не нужны авторизация, синхронизация и конкурентная запись.
Нужно другое: не терять данные при падении приложения, не сломаться на переполненном диске
и не тормозить на слабом Android.

Стек: Svelte 5 (руны), Vite, Konsta UI + Tailwind 4, MapLibre GL + PMTiles, Capacitor 8,
i18next. Точные версии смотрите в `package.json`.

## Запуск

```
index.html → src/main.js → App.svelte → маршрутизатор → экран
```

`main.js`:

1. `getThemeManager().init()` применяет тему до первой отрисовки, чтобы не было вспышки
   светлой темы.
2. `resolveAppInfo()` получает имя и версию: на устройстве из `App.getInfo()`, в вебе из
   глобальных констант сборки `__APP_NAME__`/`__APP_VERSION__`.
3. `mount(App, { props: { version, appName, appLogo } })`.
4. `SplashScreen.hide()` вызывается в `finally`. В `capacitor.config.json` стоит
   `launchAutoHide: false`, поэтому сплэш скрывается только здесь.

Сбой любого шага не останавливает запуск: используется значение по умолчанию.

`App.svelte` — оболочка приложения:

- Konsta `App`/`Page`/`Navbar`/`Panel`, нижний таббар, место для экранов маршрутизатора.
- `AppSplash.svelte` показывается, пока не завершится `onMount`, то есть до `APP_READY`.
- В `onMount` по порядку: `initFirstLaunch()`, `initBackButtonHandler()`,
  `initCustomPointsPersistence()`.
- Глобальные оверлеи: мастер первого запуска (`views/OnboardingWizard/`) и попап статьи
  (`components/Article.svelte`).
- Показывает проблемы хранилища меток (`customPointsState.takeNotices()`) тостами.

Маршруты: `src/Routes.js`, библиотека `@mateothegreat/svelte5-router`. Подробнее в
[Экраны](03-screens.md).

## Каталоги `src/`

| Каталог | Что внутри | Правило |
| --- | --- | --- |
| `capacitor/` | Обёртки нативных плагинов | Один файл — один плагин. Остальной код плагины напрямую не импортирует |
| `components/` | Переиспользуемые компоненты по фичам | Общий для нескольких фич компонент лежит в корне `components/` |
| `data/` | Статический контент: статьи, метаданные | Без логики |
| `lib/errors/` | `errorCodes.js` | Единственное место для строковых кодов ошибок |
| `lib/icons/` | SVG-иконки как компоненты | Перед добавлением проверьте, нет ли уже такой |
| `lib/state/` | Реактивное состояние на рунах (`*.svelte.js`) | См. [Состояние](07-state.md) |
| `lib/theme/` | `themeManager.js` — светлая/тёмная тема | Синглтон на чистом JS |
| `locales/` | Переводы `ru`, `en`, `pl`, `uz` | Ключи во всех четырёх одинаковые |
| `services/` | Бизнес-логика без UI и без прямых вызовов плагинов | Формат файлов, хранение, A\*, билдеры карты |
| `store/` | Классические Svelte-сторы | Новые не создаются, только существующие |
| `test/` | Хелперы для тестов | В коде приложения не импортируются |
| `utils/` | Мелкие чистые функции без рун и зависимостей | |
| `views/` | Экраны, одна папка на экран | `views/Map/` разбит на `Session/`, `Points/`, `Navigation/` |

### Куда класть новый код

1. Компонент с разметкой → `components/<Фича>/`, а если это экран — `views/<Экран>/`.
2. Реактивное состояние, общее для нескольких компонентов → `lib/state/<имя>.svelte.js`.
3. Новый нативный плагин → новый файл в `capacitor/services/` или `capacitor/utils/`.
4. Логика без UI → `services/`.
5. Маленькая чистая функция → `utils/`.
6. Тест → рядом с модулем: `<module>.js` → `<module>.test.js`.

Когда в папке накапливаются модули разных тем, они разносятся по подпапкам, названным по
содержимому (`Navigation/`, `GPS/`, `Photos/`). Названия вроде `helpers`, `utils` или `misc`
для таких подпапок не используются.

### Границы импортов (проверяет ESLint)

```js
// services/myFeature.js
import { Preferences } from '@capacitor/preferences';
import { writable } from 'svelte/store';

// правильно:
import { getStorage, setStorage } from '@/capacitor/utils/appStorage';
import { Capacitor } from '@capacitor/core';
```

Две первые строки дают ошибку `no-restricted-imports`. Плагины `@capacitor/*` (кроме
`@capacitor/core`) импортируются только в `capacitor/` и `main.js`. `writable`/`readable`/`derived`
разрешены только в старых сторах, перечисленных в `eslint.config.js`
(`STORE_FACTORY_EXCEPTIONS`). Читать стор через `get` можно везде.

## Ошибки

Пользователь видит ошибку только через один канал — `store/ui/errorToast.js`. Коды ошибок
живут только в `lib/errors/errorCodes.js`:

- `OS_PLUG_<ПЛАГИН>_<NNNN>` — коды плагинов Capacitor (геолокация, файлы, камера) со ссылкой
  на документацию плагина.
- `<ОБЛАСТЬ>_<ЧТО>` — ошибки самого приложения: `NAV_ROUTE_NOT_FOUND`, `MAP_INIT_FAILED`,
  `POINTS_IMPORT_REFUSED`.

```js
import { ERROR_CODES } from '@/lib/errors/errorCodes';
import { errorToast } from '@/store/ui/errorToast';

errorToast.error(i18n.t('errors:mapInitFailed'), { scope: 'Map', code: ERROR_CODES.MAP_INIT_FAILED });
```

Строка вида `error.code === 'OS-PLUG-FILE-0008'` в коде запрещена, тест
`lib/errors/errorCodes.test.js` ищет такие литералы. Новый код ошибки добавляется в
`errorCodes.js`, а его текст — в `locales/*/errors.js` всех четырёх языков.

## Логирование

`console.*` в коде приложения запрещён (ESLint). Вместо него логгер:

```js
import { createLogger, IS_DEBUG } from '@/utils/debugMode';

const storageLogger = createLogger('CustomPointsStorage');

IS_DEBUG && storageLogger.error('Slot write failed:', error);
```

`IS_DEBUG` равен `import.meta.env.DEV`. В production-сборке вызов не выполняется вовсе,
аргументы тоже не вычисляются. Пойманная и проглоченная ошибка должна оставлять хотя бы
debug-лог.

## Производительность

Приложение рассчитано на слабые Android-телефоны:

- Мост JS ↔ натив дорогой. Фото копируется нативно (`Filesystem.copy`), а не через base64.
  URI каталога данных запрашивается один раз и кэшируется (`getDataDirectoryUri()`).
- Изображения уменьшает сам плагин Camera: длинная сторона 1280, качество 80. Canvas-ресайз
  (`utils/imageResize.js`) используется только в веб-сборке.
- Всё, что создаёт ресурс (Blob-url, слушатель, таймер, нативный listener), освобождается в
  cleanup `$effect` или явным `release()`/`dispose()`.
- Тяжёлое грузится лениво. CSS сторонних библиотек подключается один раз в `src/App.css`.
- Архив `.pmtiles` целиком держится в памяти. Это осознанное решение: локальный сервер
  Capacitor не поддерживает Range-запросы. Подробнее в [Данные карты](10-map-data.md).
