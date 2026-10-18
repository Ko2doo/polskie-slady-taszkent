---
paths:
  - "src/services/customPoints*"
  - "src/services/mapPopupHtml.js"
  - "src/capacitor/services/share.js"
  - "src/components/CustomPoints/**"
  - "src/components/Article.svelte"
  - "src/lib/state/customPoints*"
  - "src/lib/state/photoSession.svelte.js"
  - "src/lib/state/mapMarkerFilter.svelte.js"
  - "src/views/Map/Points/MapEditMode.svelte.js"
  - "src/views/Map/Points/MapCustomPointsEditor.svelte.js"
  - "src/views/Map/Points/MapPreview.js"
  - "src/capacitor/utils/appFiles.js"
  - "src/capacitor/services/photoPicker.js"
  - "src/utils/imageResize.js"
  - "src/utils/crc32.js"
  - "src/utils/uuid.js"
---

# Custom markers subsystem

The user-created-markers feature. Read this before touching anything marker- or
photo-related.

## Format and storage

- **Format** (`services/customPointsFormat.js`): one JSON shape for on-device storage and
  for export/import files, versioned (`schemaVersion`), checksummed with CRC32
  (`utils/crc32.js` — corruption detection, not a security feature). `LIMITS` caps
  title/description/photo count; limits apply to user input and imported files, **never**
  silently to a point already on disk (a lowered limit must never delete existing data).
  `buildStorageFile()` writes a storage slot; `buildExportFile()` an export — only the shared
  fields (no preview, no photos, no revision), with its own `exportId`/`exportedAt`;
  `parseFile(text, { kind: 'import' })` reads one back as untrusted input.
- **Merge on import** (`services/customPointsMerge.js`): `mergeImportedPoints(existing,
  imported)` — the same id is the same point, the fresher `updatedAt` wins (an equal one keeps
  the device's point), an updated point keeps its local photos, preview and `createdAt`, new
  points are appended, nothing is ever deleted. Pure; returns the list and the
  added/updated/unchanged counts.
- **Export and import** — the points state does the data part: `customPointsState.exportFile()`
  (waits for the saved points), `customPointsState.previewImport(text)` (the same parse and merge,
  nothing saved — the counts for the confirmation) and `customPointsState.importFile(text)`
  (parse as untrusted, merge against the points as they are now, save at once; a file that
  changes nothing saves nothing). Both return the added/updated/unchanged counts plus `skipped`
  broken entries, or `{ ok: false, reason }`. `services/customPointsTransfer.js` moves
  the file: `deliverExportFile(text, ...)` writes it to the cache directory and opens the share
  sheet (`capacitor/services/share.js`; a closed sheet is `'cancelled'`, not an error; a browser
  download in the web build), `readImportFile(file)` reads the file picked with
  `<input type="file">` (refused unread when far over the size limit). The two never call each
  other: `components/CustomPoints/CustomPointsTransfer.svelte` (the "My markers" block of
  Settings) wires them — the export and import buttons, a hidden `<input type="file">`, a
  spinner naming the running step (exporting / checking / importing; each step yields a
  macrotask first so it paints before a big file blocks the thread). An import is two steps:
  the picked file is previewed, then `CustomPointsImportDialog.svelte` (presentational; an
  overlay toggle, so Android back cancels, released when Settings unmounts) shows what would be
  added and updated, and only its confirm imports. A file with nothing new says so instead of
  asking. The summary is an info toast, a refusal an error toast with its reason
  (`POINTS_IMPORT_REFUSED`, `POINTS_EXPORT_FAILED` in `lib/errors/errorCodes.js`). A closed
  share sheet or file chooser says nothing.
- **Storage** (`services/customPointsStorage.js`): two alternating JSON files (slot A/B); a
  write always targets the slot *other than* the last successful one, so a crash mid-write
  never corrupts previously-saved data. Loading picks the valid slot with the higher
  revision.
- **Points state** (`lib/state/customPointsState.svelte.js`): a deliberate module-level
  singleton — the map and the article popup must read the exact same reactive object (see
  `.claude/rules/state-management.md` for when a singleton is/isn't the right call). Debounces
  writes to storage, flushes when the app goes to the background
  (`onAppBackground`, `capacitor/services/appLifecycle.js`).

## Photos

- `services/customPointsPhotos.js`: native copy via `Filesystem.copy` (never pushed through
  the JS bridge as base64 unless the native copy fails, with a logged fallback). Display
  urls: `convertFileSrc` on a device, a **reference-counted** Blob-url cache on the web
  (more than one component — a thumbnail and the fullscreen viewer — can show the same
  photo at once; a url is only revoked once nothing is using it). `reconcilePhotos()` only
  runs once the points list has loaded *completely*, never on a partial/failed load.
- **Photo session** (`lib/state/photoSession.svelte.js`): the photos attached to one open
  edit form; a generation counter discards a photo that finishes saving after the form
  closed or was replaced by a new one.

## Building and display

- `services/customPointsBuilder.js` renders markers/popups on the map (mirrors
  `services/mapPointsBuilder.js` for historical places; shared popup HTML/escaping lives in
  `services/mapPopupHtml.js`).
- `components/CustomPoints/CustomPointsMapEditorDialog.svelte` — the actual marker editor
  (title, description, photos, delete). Android back closes its photo-source menu or delete
  question first, then the editor itself as its cancel does (`photoSession.discard()`).
  Not to be confused with
  `components/CustomPoints/CustomPointsDialog.svelte`, a one-time intro dialog shown before
  a user's first marker (state in `lib/state/customPointsDialogState.svelte.js`).
- `components/CustomPoints/Photos/` — `PhotoThumb.svelte` resolves one photo and shows a placeholder while loading;
  `PhotoSlider.svelte` shows one photo directly or several as a dotted slider; tapping opens
  `PhotoViewer.svelte` (fullscreen, pinch/double-tap zoom, portaled to `<body>` because
  Konsta's `Popup` is a transformed, overflow-hidden ancestor that would otherwise break a
  `position: fixed` descendant). `PhotoSlider` owns the viewer's open state via
  `createToggleOverlay` — see `.claude/rules/state-management.md`.
- `views/Map/Points/MapCustomPointsEditor.svelte.js` —
  `createCustomPointsEditor({ session, i18n })`: the map screen's editing logic — what a tap
  in the edit mode does (open a point, start a new one, refuse a place next to an article
  marker), saving and deleting the point open in the
  dialog. The map goes first everywhere: a point the builder rejects leaves the state and its
  photos untouched. It reads the builders from the map session on every call, so it never
  holds a released map. Created by `Map.svelte` once the session has started.
- `views/Map/Points/MapEditMode.svelte.js`'s `createEditModeController()` holds the editing mode's own
  state (tap coordinates, which point id is being edited, dialog open/closed); the editor
  above owns the one instance — not a singleton, since only one map screen ever exists.
- `views/Map/Points/MapPreview.js` resolves a custom point's cover photo for the map popup, and
  `lib/state/mapMarkerFilter.svelte.js` is the all/custom/historical marker filter (UI
  preference, persisted separately from the points themselves).
