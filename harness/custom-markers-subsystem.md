# Custom markers subsystem

The user-created-markers feature — the newest, most actively developed part of the app at
the time this was written. Read this before touching anything marker- or photo-related.

## Format and storage

- **Format** (`services/customPointsFormat.js`): one JSON shape for on-device storage and
  for future import/export, versioned (`schemaVersion`), checksummed with CRC32
  (`utils/crc32.js` — corruption detection, not a security feature). `LIMITS` caps
  title/description/photo count; limits apply to user input and imported files, **never**
  silently to a point already on disk (a lowered limit must never delete existing data).
- **Storage** (`services/customPointsStorage.js`): two alternating JSON files (slot A/B); a
  write always targets the slot *other than* the last successful one, so a crash mid-write
  never corrupts previously-saved data. Loading picks the valid slot with the higher
  revision.
- **Points state** (`lib/state/customPointsState.svelte.js`): a deliberate module-level
  singleton — the map and the article popup must read the exact same reactive object (see
  `harness/state-management.md` for when a singleton is/isn't the right call). Debounces
  writes to storage, flushes on `appStateChange` going to background.

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
  (title, description, photos, delete). Not to be confused with
  `components/CustomPoints/CustomPointsDialog.svelte`, a one-time intro dialog shown before
  a user's first marker (state in `lib/state/customPointsDialogState.svelte.js`).
- `PhotoThumb.svelte` resolves one photo and shows a placeholder while loading;
  `PhotoSlider.svelte` shows one photo directly or several as a dotted slider; tapping opens
  `PhotoViewer.svelte` (fullscreen, pinch/double-tap zoom, portaled to `<body>` because
  Konsta's `Popup` is a transformed, overflow-hidden ancestor that would otherwise break a
  `position: fixed` descendant). `PhotoSlider` owns the viewer's open state via
  `createToggleOverlay` — see `harness/state-management.md`.
- `views/Map/MapEditMode.svelte.js`'s `createEditModeController()` holds the map screen's
  own editing-mode state (tap coordinates, which point id is being edited, dialog open/
  closed) — one instance per `Map.svelte`, not a singleton, since only one map screen ever
  exists at a time anyway.
- `views/Map/MapPreview.js` resolves a custom point's cover photo for the map popup, and
  `lib/state/mapMarkerFilter.svelte.js` is the all/custom/historical marker filter (UI
  preference, persisted separately from the points themselves).
