# Custom markers

The user puts their own markers on the map: a title, a description, up to 4 photos. Markers
are stored on the device only; they can be exported to a file and imported on another device.

## What it's made of

```
services/customPointsFormat.js     file format: validation, checksum, limits
services/customPointsMerge.js      merging imported points into the current ones
services/customPointsStorage.js    two slots on disk, safe against a crash mid-write
services/customPointsPhotos.js     photo files, display urls, orphan cleanup
services/customPointsTransfer.js   export through the share sheet, reading an import file
services/customPointsBuilder.js    markers on the MapLibre map
lib/state/customPointsState.svelte.js   shared marker state (singleton)
lib/state/photoSession.svelte.js        photos of one open form
views/Map/Points/MapCustomPointsEditor.svelte.js   edit-mode tap, save, delete
components/CustomPoints/            dialogs, photos, the export/import block
```

Data flow:

```
map tap → MapCustomPointsEditor → customPointsState.add/update/remove
                                → customPointsBuilder.addPoint/updatePoint/removePoint
customPointsState → customPointsStorage.schedule() → slot-a.json / slot-b.json
```

## Format (`services/customPointsFormat.js`)

One format both for on-device storage and for export/import files.

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

- A storage file has `revision` and `savedAt` instead of `exportId`/`exportedAt`, and its points
  also carry `preview` and `photos`. These two fields are local: they never go into an export
  and are never accepted on import.
- `checksum` is a CRC32 (`utils/crc32.js`) of the `points` array. It catches a damaged file but
  doesn't protect against a forged one.
- A file with a `schemaVersion` newer than the app knows is refused. A file with an older one
  is migrated.
- Photo paths are checked strictly: `photos/<point id>/<uuid>.<ext>`. A path of another point
  or a path with `..` is never accepted.

Limits (`LIMITS`):

| Field | Value |
| --- | --- |
| `title` | 80 characters |
| `description` | 10,000 characters |
| `preview` | 2048 characters |
| `maxPhotos` | 4 |
| `maxPoints` | 5000 (import only) |
| `maxFileChars` | 10 MB (import only) |

The limits apply only to user input and imported files. They're never applied to a point
already on disk: if a limit is lowered, saved data isn't cut.

```js
import { buildExportFile, parseFile } from '@/services/customPointsFormat';

const text = buildExportFile(customPointsState.points);
const result = parseFile(text, { kind: 'import' });
// { ok: true, points, skipped } | { ok: false, reason }
```

`parseFile` treats the file as untrusted input: every field is validated and rebuilt, unknown
fields are dropped, damaged points are counted in `skipped`.

## Merging (`services/customPointsMerge.js`)

`mergeImportedPoints(existing, imported)` is a pure function:

- the same `id` means the same point;
- the point with the fresher `updatedAt` wins; on a tie the device's point stays;
- an updated point keeps its local `photos`, `preview` and `createdAt`;
- new points are appended;
- **nothing is ever deleted**.

```js
const parsed = parseFile(text, { kind: 'import' });
if (parsed.ok) {
  const { points, added, updated, unchanged } = mergeImportedPoints(customPointsState.points, parsed.points);
}
```

## Storage (`services/customPointsStorage.js`)

The Filesystem plugin doesn't write atomically: if the process is killed mid-write, the file is
left broken. Its `rename` deletes the target first, so "write to a temp file, then rename" won't
work either. The solution is two slots, `custom-points/slot-a.json` and
`custom-points/slot-b.json`:

- every write has its own `revision`, and always goes to the slot other than the last
  successful one;
- on load, the valid slot with the highest `revision` wins;
- a half-written slot loses to the previous one: the last edit may be lost, the saved data never.

Safety rules:

- A slot that failed to read with an error (not "file doesn't exist") → the storage goes
  read-only. Otherwise "couldn't read" would look like "empty", and the next write would wipe
  the data.
- Data written by a newer app version is never touched (read-only).
- Both slots damaged → their content is copied to `*.corrupt`, and the storage starts from scratch.

```js
import { createCustomPointsStorage } from '@/services/customPointsStorage';
import { dataFilesDriver } from '@/capacitor/utils/appFiles';

const storage = createCustomPointsStorage({ driver: dataFilesDriver, onNotice: (code) => notices.push(code) });
const { status, points } = await storage.load();
storage.schedule(() => $state.snapshot(points));
await storage.flush();
```

Writes are debounced by 400 ms, and only the latest snapshot is written. Writes never overlap.
`onNotice` codes: `StoreUnsupported`, `StoreUnreadable`, `StoreCorrupted`, `StoreSaveFailed`.
`App.svelte` shows them through `customPointsState.takeNotices()`.

`driver` is any `{ read(path), write(path, text) }` object. In the app it's `dataFilesDriver`, in
tests an in-memory recorder.

## State (`lib/state/customPointsState.svelte.js`)

A module-level singleton: the map and the article popup read the same reactive object.

| API | What it does |
| --- | --- |
| `ready` | Promise of the load from storage. Await it before the first read of `points` |
| `points` | Reactive array of points |
| `add({ coords, title, description, preview, photos, id })` | Creates a point. `id` is optional: the editor creates it up front for the photo folder |
| `getById(id)` | The point or `null` |
| `update(id, { title, description, preview, photos })` | Partial update, `null` if there's no such point. `updatedAt` changes only when a shared field changes |
| `remove(id)` | Removes the point; its photo folder is deleted in the background (if the app is killed first, `reconcilePhotos` cleans it up on start) |
| `flush()` | Writes at once |
| `exportFile()` | `{ text, count }` once the points have loaded |
| `previewImport(text)` | Parse and merge without saving: the counts for the confirmation |
| `importFile(text)` | Parse, merge, save. A file that changes nothing writes nothing |
| `takeNotices()` | Takes the collected storage problem codes |

```js
import { customPointsState } from '@/lib/state/customPointsState.svelte';

await customPointsState.ready;
const point = customPointsState.add({ coords: { lng: 69.28, lat: 41.31 }, title: 'Dom', description: '' });
customPointsState.update(point.id, { title: 'Mój dom' });
customPointsState.remove(point.id);
```

`initCustomPointsPersistence()` (called from `App.svelte`) hooks `flush()` to the app going to
the background (`onAppBackground`).

## Photos

### `services/customPointsPhotos.js`

| Function | What it does |
| --- | --- |
| `savePhoto({ pointId, source, extension, resize })` | Copies a photo to `photos/<pointId>/` with the native `Filesystem.copy`. Base64 is only a logged fallback |
| `getPhotoUrl(path)` | A url for `<img>`: `convertFileSrc` on a device, a reference-counted Blob url on the web |
| `releasePhotoUrl(path)` | Releases one reference. The Blob url is revoked once no references are left |
| `deletePhotoFiles(paths)`, `deletePointPhotos(pointId)` | Delete files or a point's whole folder |
| `pruneUnreferenced(pointId, keepPaths)` | Deletes the point's files that aren't in `keepPaths` |
| `reconcilePhotos(points)` | On start, removes orphan folders with one directory listing. Runs only after the points have loaded completely |

Reference counting is needed because the same photo can be shown by a thumbnail and the
fullscreen viewer at once. Revoking the url on unmount would break the image for the other
consumer.

### `lib/state/photoSession.svelte.js` — `createPhotoSession()`

The photos of one open form. A photo is saved to disk at once, but belongs to the point only
once the form is saved.

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

- `commit()` — the form was saved: files removed from the list are deleted.
- `discard()` — the form was cancelled: photos added in this session are deleted. A new point
  loses its whole folder.
- `end()` — the point was deleted, nothing is left to clean up.
- Getters: `pointId`, `photos`, `isBusy`, `freeSlots`, `canAdd`.
- A generation counter discards a photo that finished saving after the form had closed.

The photo source is `capacitor/services/photoPicker.js`: `takePhoto()` and
`chooseFromGallery(limit)`. The size is set by `PHOTO_SIZE = { maxSide: 1280, quality: 80 }`.

### Components `components/CustomPoints/Photos/`

- `PhotoThumb.svelte` — one photo with a placeholder while loading.
- `PhotoSlider.svelte` — one photo, or a dotted slider (Swiper). Owns the viewer's open state
  through `createToggleOverlay`.
- `PhotoViewer.svelte` — fullscreen view, pinch and double-tap zoom. Rendered through a portal
  into `<body>`: Konsta's `Popup` has a `transform` and `overflow: hidden`, and such an ancestor
  breaks a descendant's `position: fixed`.

## The editor on the map

`views/Map/Points/MapCustomPointsEditor.svelte.js` — `createCustomPointsEditor({ session, i18n })`:

```js
const editor = createCustomPointsEditor({ session, i18n: $i18n });

map.on('click', (event) => editor.handleMapClick(event));
```

```svelte
<CustomPointsMapEditorDialog onSave={editor.save} onDelete={editor.remove} />
```

- `handleMapClick(event)` opens a user marker when it's tapped and starts a new one on an empty
  spot. A tap next to a historical marker is refused with a warning (`builder.isMarkerNear`).
- `save(formData)` / `remove()` return a `boolean`. The map changes first: if the builder
  rejects the point, the state and the photos stay untouched.
- `editingPoint` is reactive: the point in the dialog, or `null` for a new one.
- The editor reads the builders from the session on every call, so it never holds on to a
  released map.

Dialogs:

- `CustomPointsMapEditorDialog.svelte` — the editor itself: title, description, photos, delete.
  The Android Back button first closes the photo-source menu or the delete question, then the
  whole editor, as cancel does.
- `CustomPointsDialog.svelte` — a one-time intro dialog before the first marker
  (`lib/state/customPointsDialogState.svelte.js`). Not to be confused with the editor.

The "all / mine / historical" filter is `lib/state/mapMarkerFilter.svelte.js`
(`MARKER_FILTER.ALL | CUSTOM | HISTORICAL`). Stored in Preferences, separately from the markers.

## Export and import

The "My markers" block in Settings is `components/CustomPoints/CustomPointsTransfer.svelte`.

```js
import { deliverExportFile, readImportFile } from '@/services/customPointsTransfer';

const { text } = await customPointsState.exportFile();
const outcome = await deliverExportFile(text, { title, dialogTitle });
// 'shared' | 'cancelled' | 'downloaded'

const read = await readImportFile(input.files[0]);
if (read.ok) {
  const preview = await customPointsState.previewImport(read.text);
  // show CustomPointsImportDialog, on confirm:
  await customPointsState.importFile(read.text);
}
```

- `deliverExportFile` writes the file to the cache (`writeShareableTextFile`) and opens the
  system share sheet (`capacitor/services/share.js`). On the web the file is downloaded
  (`utils/downloadTextFile.js`). A closed sheet is `'cancelled'`, not an error.
- `exportFileName(date)` → `polskie-slady-points-2026-10-18.json` (the device's local date).
- `readImportFile(file)` reads the file from `<input type="file">` and returns `{ ok: true, text }`
  or `{ ok: false, reason: 'noFile' | 'tooLarge' | 'unreadable' }`. A file over
  `LIMITS.maxFileChars × 4` bytes (UTF-8) is refused without being read.
- An import takes two steps: preview (`previewImport`) → `CustomPointsImportDialog.svelte` with
  how many would be added and updated → confirm → `importFile`. A file with nothing new says so
  and asks for no confirmation.
- Before each step the spinner gets one macrotask to paint: otherwise a big file would block
  the thread before the spinner appears.
- The result is an info toast. A refusal is an error toast with the reason
  (`POINTS_IMPORT_REFUSED`, `POINTS_EXPORT_FAILED`).
