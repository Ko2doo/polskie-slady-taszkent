# Native layer (`capacitor/`)

Every native Capacitor plugin is wrapped in one file, and the rest of the code calls only these
wrappers. A wrapper deals with platform quirks, translates error codes and decides what happens
on a failure. ESLint forbids importing `@capacitor/*` (except `@capacitor/core`) outside
`capacitor/` and `main.js`.

| File | Plugin | What it provides |
| --- | --- | --- |
| `capacitor/backButton.js` | `@capacitor/app` | `initBackButtonHandler()` — the hardware Back button, Android only |
| `capacitor/services/appLifecycle.js` | `@capacitor/app` | `onAppBackground(callback)` — the app going to the background |
| `capacitor/services/gpsTracker.js` | `@capacitor/geolocation` | `createGPSTracker()`, see [Navigation](06-navigation.md) |
| `capacitor/services/locationPermission.js` | `@capacitor/geolocation`, `capacitor-native-settings` | Location permission, opening settings, `mapGeolocationError` |
| `capacitor/services/photoPicker.js` | `@capacitor/camera` | `takePhoto()`, `chooseFromGallery(limit)` |
| `capacitor/services/share.js` | `@capacitor/share` | `shareFile({ uri, title, dialogTitle })` — the system share sheet |
| `capacitor/services/i18n.js` | `@capacitor/device` | i18next setup, the device language on first launch (the choice is stored through `appStorage`), `i18nStores` |
| `capacitor/utils/appFiles.js` | `@capacitor/filesystem` | Files in the app's private directory |
| `capacitor/utils/appStorage.js` | `@capacitor/preferences` | Small values and preferences |

A new plugin is a new file here. After installing a plugin, run `npm run build:sync:android`,
and if the plugin needs permissions, add them to `android/app/src/main/AndroidManifest.xml` and
`ios/App/App/Info.plist`.

## Preferences (`capacitor/utils/appStorage.js`)

```js
import { getStorage, setStorage, removeStorageItem } from '@/capacitor/utils/appStorage';

const isSaved = await setStorage('app.onboarding.completed', true);
const isCompleted = await getStorage('app.onboarding.completed', false);
await removeStorageItem('app.onboarding.completed');
```

- Values are stored as JSON and read back with their own type: `'42'` stays a string.
- The functions **never throw**: a broken storage must not crash a screen. `setStorage` returns
  `false` on a failure, `getStorage` returns `fallback`.
- Values saved by older versions as raw text (`'en'`) still read back.

## Files (`capacitor/utils/appFiles.js`)

By default everything lives in `Directory.Data`: the app's private storage, no permissions needed.

| Function | Returns | On error |
| --- | --- | --- |
| `readTextFile(path)` | the text, or `null` if the file doesn't exist | **throws** |
| `writeTextFile(path, text)` | the uri or `null` | `null` |
| `writeShareableTextFile(path, text)` | a `file://` uri in the cache (for sharing) or `null` | `null` |
| `listDirectory(path)` | `[{ name, type }]`, empty if the directory doesn't exist | **throws** |
| `ensureDirectory(path)` | `true` if the directory exists afterwards | `false` |
| `removeFile(path)`, `removeDirectory(path)` | `false` only if deleting really failed | `false` |
| `copyFileToData(from, to)` | `boolean` (native copy) | `false` |
| `writeBinaryFile(path, data)` | the uri or `null` | `null` |
| `readBinaryFile(path)` | a `Blob` (web), base64 or `null` | **throws** |
| `getDataDirectoryUri()` | the data directory's base uri, cached after the first call | |
| `dataFilesDriver` | `{ read, write }` for `createCustomPointsStorage` | `write` throws |

Why reading throws: "couldn't read" must never be mistaken for "the file doesn't exist".
Otherwise the caller would decide there's no data and overwrite the user's data.

```js
import { readTextFile, writeTextFile } from '@/capacitor/utils/appFiles';

const text = await readTextFile('custom-points/slot-a.json');
if (text === null) {
  // no file — that's fine
}
const uri = await writeTextFile('notes/today.txt', 'hello');
```

## Background and lifecycle

```js
import { onAppBackground } from '@/capacitor/services/appLifecycle';

const stopListening = onAppBackground(() => customPointsState.flush());
await stopListening();
```

## Sharing a file

```js
import { writeShareableTextFile } from '@/capacitor/utils/appFiles';
import { shareFile } from '@/capacitor/services/share';

const uri = await writeShareableTextFile('exports/points.json', text);
const outcome = await shareFile({ uri, title, dialogTitle });
// 'shared' | 'cancelled'; throws if the sheet couldn't be shown
```

## Photos

```js
import { takePhoto, chooseFromGallery, PhotoPickerError, PHOTO_SIZE } from '@/capacitor/services/photoPicker';

try {
  const [photo] = await takePhoto();
  const photos = await chooseFromGallery(3);
} catch (error) {
  if (error instanceof PhotoPickerError && error.kind === 'denied') showPermissionHint();
}
```

Both functions return `[{ uri, webPath }]`. If the user cancelled, the array is empty. The size
(`PHOTO_SIZE`, long side 1280, quality 80) is passed to the Camera plugin on a device; on the web
`utils/imageResize.js` downscales the photo.

## Error codes (`lib/errors/errorCodes.js`)

| Kind | Format | Example |
| --- | --- | --- |
| Geolocation (normalized) | `OS_PLUG_GLOC_NNNN` | `ERROR_CODES.OS_PLUG_GLOC_0003` |
| Files, camera (as the plugin reports them) | `OS-PLUG-FILE-NNNN` | `ERROR_CODES.OS_PLUG_FILE_0008` — no such file |
| The app | `<DOMAIN>_<WHAT>` | `NAV_ROUTE_NOT_FOUND`, `GPS_OUT_OF_BOUNDS`, `POINTS_IMPORT_REFUSED` |

```js
import { ERROR_CODES } from '@/lib/errors/errorCodes';

if (error.code === ERROR_CODES.OS_PLUG_FILE_0008) return null;
```

A new error code:

1. A constant in `ERROR_CODES` with a link to the plugin's docs (for a plugin code).
2. Its text in `locales/{ru,en,pl,uz}/errors.js`.
3. Used only as `ERROR_CODES.X`.
