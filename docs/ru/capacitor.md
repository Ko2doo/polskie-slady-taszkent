# Нативный слой (`capacitor/`)

Каждый нативный плагин Capacitor обёрнут в один файл, и остальной код вызывает только эти
обёртки. Обёртка обрабатывает особенности платформ, переводит коды ошибок и решает, что
делать при сбое. Импорт `@capacitor/*` (кроме `@capacitor/core`) за пределами `capacitor/` и
`main.js` ESLint запрещает.

| Файл | Плагин | Что даёт |
| --- | --- | --- |
| `capacitor/backButton.js` | `@capacitor/app` | `initBackButtonHandler()` — аппаратная кнопка «Назад», только Android |
| `capacitor/services/appLifecycle.js` | `@capacitor/app` | `onAppBackground(callback)` — уход приложения в фон |
| `capacitor/services/gpsTracker.js` | `@capacitor/geolocation` | `createGPSTracker()`, см. [Навигация](navigation.md) |
| `capacitor/services/locationPermission.js` | `@capacitor/geolocation`, `capacitor-native-settings` | Разрешение на геолокацию, переход в настройки, `mapGeolocationError` |
| `capacitor/services/photoPicker.js` | `@capacitor/camera` | `takePhoto()`, `chooseFromGallery(limit)` |
| `capacitor/services/share.js` | `@capacitor/share` | `shareFile({ uri, title, dialogTitle })` — системное меню «Поделиться» |
| `capacitor/services/i18n.js` | `@capacitor/device` | Настройка i18next, язык устройства при первом запуске (выбор хранится через `appStorage`), `i18nStores` |
| `capacitor/utils/appFiles.js` | `@capacitor/filesystem` | Файлы в приватном каталоге приложения |
| `capacitor/utils/appStorage.js` | `@capacitor/preferences` | Небольшие значения и настройки |

Новый плагин — это новый файл здесь. После установки плагина нужно выполнить
`npm run build:sync:android`, а если плагин требует разрешений, прописать их в
`android/app/src/main/AndroidManifest.xml` и `ios/App/App/Info.plist`.

## Настройки (`capacitor/utils/appStorage.js`)

```js
import { getStorage, setStorage, removeStorageItem } from '@/capacitor/utils/appStorage';

const isSaved = await setStorage('app.onboarding.completed', true);
const isCompleted = await getStorage('app.onboarding.completed', false);
await removeStorageItem('app.onboarding.completed');
```

- Значения хранятся как JSON и читаются обратно со своим типом: `'42'` остаётся строкой.
- Функции **никогда не бросают** исключений: битое хранилище не должно ронять экран.
  `setStorage` возвращает `false` при сбое, `getStorage` возвращает `fallback`.
- Значения от старых версий, записанные сырым текстом (`'en'`), тоже читаются.

## Файлы (`capacitor/utils/appFiles.js`)

По умолчанию всё лежит в `Directory.Data`: это приватное хранилище приложения, разрешения не нужны.

| Функция | Возвращает | При ошибке |
| --- | --- | --- |
| `readTextFile(path)` | текст или `null`, если файла нет | **бросает** |
| `writeTextFile(path, text)` | uri или `null` | `null` |
| `writeShareableTextFile(path, text)` | `file://` uri в кэше (для «Поделиться») или `null` | `null` |
| `listDirectory(path)` | `[{ name, type }]`, пусто, если каталога нет | **бросает** |
| `ensureDirectory(path)` | `true`, если каталог существует | `false` |
| `removeFile(path)`, `removeDirectory(path)` | `false` только при реальной ошибке удаления | `false` |
| `copyFileToData(from, to)` | `boolean` (нативное копирование) | `false` |
| `writeBinaryFile(path, data)` | uri или `null` | `null` |
| `readBinaryFile(path)` | `Blob` (веб), base64 или `null` | **бросает** |
| `getDataDirectoryUri()` | базовый uri каталога данных, кэшируется после первого вызова | |
| `dataFilesDriver` | `{ read, write }` для `createCustomPointsStorage` | `write` бросает |

Почему чтение бросает исключение: «не смог прочитать» нельзя путать с «файла нет». Иначе
вызывающий код решит, что данных нет, и перезапишет данные пользователя.

```js
import { readTextFile, writeTextFile } from '@/capacitor/utils/appFiles';

const text = await readTextFile('custom-points/slot-a.json');
if (text === null) {
  // файла нет — это нормально
}
const uri = await writeTextFile('notes/today.txt', 'hello');
```

## Фон и жизненный цикл

```js
import { onAppBackground } from '@/capacitor/services/appLifecycle';

const stopListening = onAppBackground(() => customPointsState.flush());
await stopListening();
```

## Поделиться файлом

```js
import { writeShareableTextFile } from '@/capacitor/utils/appFiles';
import { shareFile } from '@/capacitor/services/share';

const uri = await writeShareableTextFile('exports/points.json', text);
const outcome = await shareFile({ uri, title, dialogTitle });
// 'shared' | 'cancelled'; бросает, если меню не удалось показать
```

## Фото

```js
import { takePhoto, chooseFromGallery, PhotoPickerError, PHOTO_SIZE } from '@/capacitor/services/photoPicker';

try {
  const [photo] = await takePhoto();
  const photos = await chooseFromGallery(3);
} catch (error) {
  if (error instanceof PhotoPickerError && error.kind === 'denied') showPermissionHint();
}
```

Обе функции возвращают `[{ uri, webPath }]`. Если пользователь отменил выбор, массив пустой.
Размер (`PHOTO_SIZE`, длинная сторона 1280, качество 80) на устройстве задаётся плагину Camera,
в вебе фото уменьшает `utils/imageResize.js`.

## Коды ошибок (`lib/errors/errorCodes.js`)

| Тип | Формат | Пример |
| --- | --- | --- |
| Геолокация (нормализованные) | `OS_PLUG_GLOC_NNNN` | `ERROR_CODES.OS_PLUG_GLOC_0003` |
| Файлы, камера (как отдаёт плагин) | `OS-PLUG-FILE-NNNN` | `ERROR_CODES.OS_PLUG_FILE_0008` — файла нет |
| Приложение | `<ОБЛАСТЬ>_<ЧТО>` | `NAV_ROUTE_NOT_FOUND`, `GPS_OUT_OF_BOUNDS`, `POINTS_IMPORT_REFUSED` |

```js
import { ERROR_CODES } from '@/lib/errors/errorCodes';

if (error.code === ERROR_CODES.OS_PLUG_FILE_0008) return null;
```

Новый код ошибки:

1. Константа в `ERROR_CODES` со ссылкой на документацию плагина (для кода плагина).
2. Текст в `locales/{ru,en,pl,uz}/errors.js`.
3. Использование только через `ERROR_CODES.X`.
