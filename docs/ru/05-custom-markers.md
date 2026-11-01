# Пользовательские метки

Пользователь ставит на карту свои метки: заголовок, описание, до 4 фото. Метки хранятся
только на устройстве, их можно экспортировать в файл и импортировать на другом устройстве.

## Из чего состоит

```
services/customPointsFormat.js     формат файла: валидация, контрольная сумма, лимиты
services/customPointsMerge.js      слияние импортированных точек с текущими
services/customPointsStorage.js    два слота на диске, защита от падения во время записи
services/customPointsPhotos.js     файлы фото, url для показа, очистка сирот
services/customPointsTransfer.js   экспорт через «Поделиться», чтение файла импорта
services/customPointsBuilder.js    метки на карте MapLibre
lib/state/customPointsState.svelte.js   общее состояние меток (синглтон)
lib/state/photoSession.svelte.js        фото одной открытой формы
views/Map/Points/MapCustomPointsEditor.svelte.js   тап в режиме редактирования, сохранение, удаление
components/CustomPoints/            диалоги, фото, блок экспорта/импорта
```

Поток данных:

```
тап по карте → MapCustomPointsEditor → customPointsState.add/update/remove
                                     → customPointsBuilder.addPoint/updatePoint/removePoint
customPointsState → customPointsStorage.schedule() → slot-a.json / slot-b.json
```

## Формат (`services/customPointsFormat.js`)

Один формат и для хранения на устройстве, и для файлов экспорта/импорта.

```json
{
  "format": "psl.custom-points",
  "schemaVersion": 1,
  "appVersion": "1.2.0",
  "exportId": "3f1c…",
  "exportedAt": 1760800000000,
  "checksum": "crc32:9a0b1c2d",
  "points": [
    {
      "id": "6d2e…",
      "title": "Kościół",
      "description": "…",
      "coords": { "lng": 69.2797, "lat": 41.3111 },
      "createdAt": 1760700000000,
      "updatedAt": 1760750000000
    }
  ]
}
```

- В файле хранилища вместо `exportId`/`exportedAt` стоят `revision` и `savedAt`, а у точек есть
  ещё `preview` и `photos`. Эти два поля локальные: в экспорт они не попадают и при импорте
  не принимаются.
- `checksum` — CRC32 (`utils/crc32.js`) массива `points`. Он ловит повреждённый файл, но от
  подделки не защищает.
- Файл со `schemaVersion` новее, чем знает приложение, отклоняется. Файл со старой версией
  мигрируется.
- Пути фото проверяются строго: `photos/<id точки>/<uuid>.<ext>`. Путь другой точки или путь
  с `..` не принимается.

Лимиты (`LIMITS`):

| Поле | Значение |
| --- | --- |
| `title` | 80 символов |
| `description` | 10 000 символов |
| `preview` | 2048 символов |
| `maxPhotos` | 4 |
| `maxPoints` | 5000 (только импорт) |
| `maxFileChars` | 10 МБ (только импорт) |

Лимиты применяются только к пользовательскому вводу и импортированным файлам. К точке, которая
уже лежит на диске, они не применяются: если лимит уменьшится, сохранённые данные не обрежутся.

```js
import { buildExportFile, parseFile } from '@/services/customPointsFormat';

const text = buildExportFile(customPointsState.points);
const result = parseFile(text, { kind: 'import' });
// { ok: true, points, skipped } | { ok: false, reason }
```

`parseFile` считает файл недоверенным входом: каждое поле проверяется и собирается заново,
неизвестные поля отбрасываются, повреждённые точки считаются в `skipped`.

## Слияние (`services/customPointsMerge.js`)

`mergeImportedPoints(existing, imported)` — чистая функция:

- одинаковый `id` означает одну и ту же точку;
- побеждает точка с более свежим `updatedAt`; при равенстве остаётся точка устройства;
- у обновлённой точки сохраняются её локальные `photos`, `preview` и `createdAt`;
- новые точки добавляются в конец;
- **ничего не удаляется**.

```js
const parsed = parseFile(text, { kind: 'import' });
if (parsed.ok) {
  const { points, added, updated, unchanged } = mergeImportedPoints(customPointsState.points, parsed.points);
}
```

## Хранение (`services/customPointsStorage.js`)

Плагин Filesystem пишет неатомарно: если процесс убит посреди записи, файл остаётся битым. Его
`rename` сначала удаляет целевой файл, поэтому схема «записать во временный, потом
переименовать» тоже не годится. Решение — два слота, `custom-points/slot-a.json` и
`custom-points/slot-b.json`:

- у каждой записи свой `revision`, и пишется всегда слот, отличный от последнего удачного;
- при загрузке выигрывает валидный слот с наибольшим `revision`;
- полузаписанный слот проигрывает предыдущему: может потеряться последняя правка, но не
  сохранённые данные.

Правила безопасности:

- Слот не прочитался с ошибкой (а не «файла нет») → хранилище становится read-only. Иначе
  «не смог прочитать» выглядело бы как «пусто», и следующая запись затёрла бы данные.
- Данные от более новой версии приложения не трогаются (read-only).
- Оба слота битые → их содержимое копируется в `*.corrupt`, и хранилище начинает с нуля.

```js
import { createCustomPointsStorage } from '@/services/customPointsStorage';
import { dataFilesDriver } from '@/capacitor/utils/appFiles';

const storage = createCustomPointsStorage({ driver: dataFilesDriver, onNotice: (code) => notices.push(code) });
const { status, points } = await storage.load();
storage.schedule(() => $state.snapshot(points));
await storage.flush();
```

Запись идёт с дебаунсом 400 мс, и пишется только последний снимок. Записи никогда не
пересекаются. Коды `onNotice`: `StoreUnsupported`, `StoreUnreadable`, `StoreCorrupted`,
`StoreSaveFailed`. Их показывает `App.svelte` через `customPointsState.takeNotices()`.

`driver` — любой объект `{ read(path), write(path, text) }`. В приложении это `dataFilesDriver`,
в тестах — рекордер в памяти.

## Состояние (`lib/state/customPointsState.svelte.js`)

Модульный синглтон: карта и попап статьи читают один и тот же реактивный объект.

| API | Что делает |
| --- | --- |
| `ready` | Promise загрузки из хранилища. Перед первым чтением `points` его нужно дождаться |
| `points` | Реактивный массив точек |
| `add({ coords, title, description, preview, photos, id })` | Создаёт точку. `id` необязателен: редактор создаёт его заранее под папку фото |
| `getById(id)` | Точка или `null` |
| `update(id, { title, description, preview, photos })` | Частичное обновление, `null` если точки нет. `updatedAt` меняется только при смене общих полей |
| `remove(id)` | Удаляет точку; папка фото удаляется в фоне (если приложение убито раньше, её подчистит `reconcilePhotos` при старте) |
| `flush()` | Немедленная запись |
| `exportFile()` | `{ text, count }` после загрузки точек |
| `previewImport(text)` | Разбор и слияние без сохранения: счётчики для подтверждения |
| `importFile(text)` | Разбор, слияние, сохранение. Если файл ничего не меняет, ничего и не пишется |
| `takeNotices()` | Забирает накопленные коды проблем хранилища |

```js
import { customPointsState } from '@/lib/state/customPointsState.svelte';

await customPointsState.ready;
const point = customPointsState.add({ coords: { lng: 69.28, lat: 41.31 }, title: 'Dom', description: '' });
customPointsState.update(point.id, { title: 'Mój dom' });
customPointsState.remove(point.id);
```

`initCustomPointsPersistence()` (вызывается из `App.svelte`) подписывает `flush()` на уход
приложения в фон (`onAppBackground`).

## Фото

### `services/customPointsPhotos.js`

| Функция | Что делает |
| --- | --- |
| `savePhoto({ pointId, source, extension, resize })` | Копирует фото в `photos/<pointId>/` нативным `Filesystem.copy`. Base64 используется только как запасной путь, с логом |
| `getPhotoUrl(path)` | url для `<img>`: на устройстве `convertFileSrc`, в вебе Blob-url со счётчиком ссылок |
| `releasePhotoUrl(path)` | Освобождает одну ссылку. Blob-url отзывается, когда ссылок не осталось |
| `deletePhotoFiles(paths)`, `deletePointPhotos(pointId)` | Удаляют файлы или всю папку точки |
| `pruneUnreferenced(pointId, keepPaths)` | Удаляет файлы точки, которых нет в `keepPaths` |
| `reconcilePhotos(points)` | При старте одним листингом каталога удаляет папки-сироты. Запускается только после полной загрузки точек |

Счётчик ссылок нужен потому, что одно и то же фото может одновременно показывать миниатюра
и полноэкранный просмотр. Если отзывать url при размонтировании, у второго потребителя
картинка сломается.

### `lib/state/photoSession.svelte.js` — `createPhotoSession()`

Фото одной открытой формы. Снимок сохраняется на диск сразу, но к точке относится только
после сохранения формы.

```js
const photoSession = createPhotoSession();

photoSession.begin({ pointId, photos, isNew });
const { status, added } = await photoSession.add('camera');
photoSession.setCover(path);
photoSession.remove(path);
photoSession.commit();
photoSession.discard();
photoSession.end();
```

- `commit()` — форма сохранена: удаляются файлы, убранные из списка.
- `discard()` — форма отменена: удаляются фото, добавленные в этой сессии. У новой точки
  удаляется вся папка.
- `end()` — точка удалена, чистить больше нечего.
- Геттеры: `pointId`, `photos`, `isBusy`, `freeSlots`, `canAdd`.
- Счётчик поколений отбрасывает фото, которое досохранилось уже после закрытия формы.

Источник фото — `capacitor/services/photoPicker.js`: `takePhoto()` и
`chooseFromGallery(limit)`. Размер задаёт `PHOTO_SIZE = { maxSide: 1280, quality: 80 }`.

### Компоненты `components/CustomPoints/Photos/`

- `PhotoThumb.svelte` — одно фото с плейсхолдером на время загрузки.
- `PhotoSlider.svelte` — одно фото или слайдер с точками (Swiper). Владеет состоянием
  открытия просмотрщика через `createToggleOverlay`.
- `PhotoViewer.svelte` — полноэкранный просмотр, pinch и double-tap zoom. Рендерится через
  портал в `<body>`: у Konsta `Popup` есть `transform` и `overflow: hidden`, а такой предок
  ломает `position: fixed` у потомка.

## Редактор на карте

`views/Map/Points/MapCustomPointsEditor.svelte.js` — `createCustomPointsEditor({ session, i18n })`:

```js
const editor = createCustomPointsEditor({ session, i18n: $i18n });

map.on('click', (event) => editor.handleMapClick(event));
```

```svelte
<CustomPointsMapEditorDialog onSave={editor.save} onDelete={editor.remove} />
```

- `handleMapClick(event)` при тапе по своей метке открывает её, при тапе по пустому месту
  начинает новую. Тап рядом с историческим маркером отклоняется с предупреждением
  (`builder.isMarkerNear`).
- `save(formData)` / `remove()` возвращают `boolean`. Первой меняется карта: если билдер
  отклонил точку, состояние и фото не трогаются.
- `editingPoint` — реактивное поле: точка в диалоге или `null` для новой.
- Билдеры редактор берёт из сессии при каждом вызове, поэтому не держит ссылку на уже
  освобождённую карту.

Диалоги:

- `CustomPointsMapEditorDialog.svelte` — сам редактор: заголовок, описание, фото, удаление.
  Кнопка «Назад» на Android сначала закрывает меню выбора фото или вопрос об удалении, потом
  весь редактор, как отмена.
- `CustomPointsDialog.svelte` — одноразовый вводный диалог перед первой меткой
  (`lib/state/customPointsDialogState.svelte.js`). С редактором его не путать.

Фильтр «все / мои / исторические» — `lib/state/mapMarkerFilter.svelte.js`
(`MARKER_FILTER.ALL | CUSTOM | HISTORICAL`). Хранится в Preferences, отдельно от меток.

## Экспорт и импорт

Блок «Мои метки» в Settings — `components/CustomPoints/CustomPointsTransfer.svelte`.

```js
import { deliverExportFile, readImportFile } from '@/services/customPointsTransfer';

const { text } = await customPointsState.exportFile();
const outcome = await deliverExportFile(text, { title, dialogTitle });
// 'shared' | 'cancelled' | 'downloaded'

const read = await readImportFile(input.files[0]);
if (read.ok) {
  const preview = await customPointsState.previewImport(read.text);
  // показать CustomPointsImportDialog, по подтверждению:
  await customPointsState.importFile(read.text);
}
```

- `deliverExportFile` пишет файл в кэш (`writeShareableTextFile`) и открывает системное меню
  «Поделиться» (`capacitor/services/share.js`). В вебе файл скачивается
  (`utils/downloadTextFile.js`). Закрытое меню — это `'cancelled'`, а не ошибка.
- `exportFileName(date)` → `polskie-slady-points-2026-10-18.json` (локальная дата устройства).
- `readImportFile(file)` читает файл из `<input type="file">` и возвращает `{ ok: true, text }` или
  `{ ok: false, reason: 'noFile' | 'tooLarge' | 'unreadable' }`. Файл больше
  `LIMITS.maxFileChars × 4` байт (UTF-8) отклоняется без чтения.
- Импорт идёт в два шага: предпросмотр (`previewImport`) → `CustomPointsImportDialog.svelte`
  с числом добавляемых и обновляемых → подтверждение → `importFile`. Если в файле нет ничего
  нового, так и говорится, подтверждение не спрашивается.
- Перед каждым шагом спиннер получает один макротаск на отрисовку: иначе большой файл
  заблокировал бы поток раньше, чем спиннер появится.
- Итог показывается info-тостом. Отказ — error-тостом с причиной (`POINTS_IMPORT_REFUSED`,
  `POINTS_EXPORT_FAILED`).
