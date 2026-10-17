<script>
  import { untrack } from "svelte";
  import Close from "@/lib/icons/Close.svelte";
  import TrashBinIcon from "@/lib/icons/TrashBinIcon.svelte";
  import PhotoThumb from "@/components/CustomPoints/PhotoThumb.svelte";
  import { createPhotoSession } from "@/lib/state/photoSession.svelte";
  import { errorToast } from "@/store/ui/errorToast";
  import { overlayController } from "@/store/ui/overlayController";
  import { LIMITS } from "@/services/customPointsFormat";
  import { createLogger, IS_DEBUG } from "@/utils/debugMode";
  import { createId } from "@/utils/uuid";
  import {
    Actions,
    ActionsButton,
    ActionsGroup,
    Block,
    BlockTitle,
    Button,
    Dialog,
    DialogButton,
    Link,
    List,
    ListButton,
    ListInput,
    ListItem,
    Sheet,
    Toolbar,
    ToolbarPane,
  } from "konsta/svelte";

  // editingPoint - custom point to update or delete, null/undefined when a new point is being created
  let { i18n, coords, opened, editingPoint, onCloseModal, onSave, onDelete } = $props();

  const modalLogger = createLogger("CustomPointsMapEditorDialog");

  let title = $state("");
  let description = $state("");
  let isDeleteDialogOpened = $state(false);
  let isActionsOpened = $state(false);

  // The photos of this form (see createPhotoSession): saved when the form is saved, deleted when it is cancelled
  const photoSession = createPhotoSession();

  // Edit mode of the dialog. It is updated only while the dialog is open, so the texts and the delete button
  // do not switch to the "create" state during the closing animation (e.g. right after the point was deleted)
  let isEditing = $state(false);

  // Fill the form with the data of the point every time the dialog is opened
  $effect(() => {
    if (!opened) return;

    isEditing = Boolean(editingPoint);

    // Only `opened` and `editingPoint` must trigger this effect, not the fields of the point.
    // A new point has no id yet: it is created now, so its photos already have a folder
    untrack(() => {
      photoSession.begin({
        pointId: editingPoint ? editingPoint.id : createId(),
        photos: editingPoint ? editingPoint.photos : [],
        isNew: !editingPoint,
      });
    });

    if (!editingPoint) return;

    untrack(() => {
      title = editingPoint.title;
      description = editingPoint.description;
    });
  });

  // The input is blocked at the limit (maxlength), the counter turns red to show why
  const isTitleLimitReached = $derived(title.length >= LIMITS.title);
  const isDescriptionLimitReached = $derived(description.length >= LIMITS.description);
  const isPhotosLimitReached = $derived(photoSession.photos.length >= LIMITS.maxPhotos);

  const coordsLabel = $derived.by(() => {
    if (!coords) return "";

    return `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
  });

  function resetForm() {
    title = "";
    description = "";
    isActionsOpened = false;
  }

  function handleSave() {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      IS_DEBUG && modalLogger.warn("Title is required");
      return;
    }

    const isSaved = onSave({
      title: trimmedTitle,
      description: description.trim(),
      photos: [...photoSession.photos],
      pointId: photoSession.pointId,
    });

    // If saving failed, keep the entered data (and the photos)
    if (isSaved) {
      photoSession.commit();
      resetForm();
    }
  }

  function handleClose() {
    photoSession.discard();
    resetForm();
    onCloseModal();
  }

  // Android back closes the top-most layer first: the photo source menu, then the delete
  // confirmation, then the editor itself — which then behaves like its cancel button (the photos
  // of a new point are discarded)
  function handleBack() {
    if (isActionsOpened) {
      isActionsOpened = false;
      return;
    }
    if (isDeleteDialogOpened) {
      isDeleteDialogOpened = false;
      return;
    }
    handleClose();
  }

  // On the back-button overlay stack while open; the cleanup runs on close and also when the map
  // screen goes away with the editor still open, so no dead overlay is left behind
  $effect(() => {
    if (!opened) return;

    const overlayId = overlayController.register(handleBack);
    return () => overlayController.unregister(overlayId);
  });

  async function handlePick(kind) {
    isActionsOpened = false;

    const { status } = await photoSession.add(kind);

    if (status === "truncated" || status === "limit") {
      errorToast.warn($i18n.t("errors:customPointsPhotoLimit", { max: LIMITS.maxPhotos }));
    } else if (status === "denied") {
      errorToast.warn($i18n.t("errors:customPointsPhotoDenied"));
    } else if (status === "failed") {
      errorToast.error($i18n.t("errors:customPointsPhotoFailed"));
    }
  }

  function handleDeleteRequest() {
    isDeleteDialogOpened = true;
  }

  function handleDeleteCancel() {
    isDeleteDialogOpened = false;
  }

  function handleDeleteConfirm() {
    const isDeleted = onDelete();

    isDeleteDialogOpened = false;

    // If deleting failed, the editor stays open with the entered data
    if (isDeleted) {
      // The photos of the point are deleted together with it
      photoSession.end();
      resetForm();
    } else {
      IS_DEBUG && modalLogger.error("Failed to delete the point");

      errorToast.error($i18n.t("errors:customPointsDeleteFailed"), {
        scope: "CustomPointsMapEditorDialog",
      });
    }
  }
</script>

<!-- Character counter under a field: Konsta shows `info` normally and `error` (red) when the limit is reached -->
{#snippet counter(count, max)}
  <span class="block text-right text-xs" aria-label={$i18n.t("ui:map:mapEditor:charCount", { count, max })}>
    {count} / {max}
  </span>
{/snippet}

{#snippet titleCounter()}
  {@render counter(title.length, LIMITS.title)}
{/snippet}

{#snippet descriptionCounter()}
  {@render counter(description.length, LIMITS.description)}
{/snippet}

<Sheet class="pb-safe flex flex-col max-h-[85vh]" {opened}>
  <article class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
    <Toolbar top innerClass="w-full items-center" class="shrink-0 justify-end ios:pt-4">
      <div class="ios:hidden"></div>

      <span class="text-xl font-bold text-stone-600 dark:text-stone-300">
        {isEditing ? $i18n.t("ui:map:mapEditor:modalTitleUpdates") : $i18n.t("ui:map:mapEditor:modalTitleCreate")}
      </span>

      <div class="flex flex-row gap-2">
        <ToolbarPane>
          {#if isEditing}
            <Link class="p-2" iconOnly onClick={handleDeleteRequest}>
              <TrashBinIcon className="size-5 text-red-500" />
            </Link>
          {/if}

          <Link class="p-2" iconOnly onClick={handleClose}>
            <Close className="size-5" />
          </Link>
        </ToolbarPane>
      </div>
    </Toolbar>

    <BlockTitle>
      <h3>{$i18n.t("ui:map:mapEditor:coords", { coords: coordsLabel })}</h3>
    </BlockTitle>
    <Block>
      <List strongIos insetIos>
        <ListInput
          bind:value={title}
          label={$i18n.t("ui:map:mapEditor:title")}
          floatingLabel
          type="text"
          placeholder={$i18n.t("ui:map:mapEditor:titlePlaceholder")}
          maxlength={LIMITS.title}
          info={titleCounter}
          error={isTitleLimitReached ? titleCounter : undefined}
          required
        />
        <ListInput
          bind:value={description}
          label={$i18n.t("ui:map:mapEditor:description")}
          floatingLabel
          type="textarea"
          placeholder={$i18n.t("ui:map:mapEditor:descriptionPlaceholder")}
          maxlength={LIMITS.description}
          info={descriptionCounter}
          error={isDescriptionLimitReached ? descriptionCounter : undefined}
          required
        />

        <!-- Photos: the first one is the cover -->
        <ListItem>
          {#snippet inner()}
            <div class="w-full py-2">
              <div class="flex items-center justify-between">
                <span class="text-sm opacity-70">{$i18n.t("ui:map:mapEditor:photosTitle")}</span>

                <span
                  class="text-xs {isPhotosLimitReached ? 'text-red-500' : 'opacity-50'}"
                  aria-label={$i18n.t("ui:map:mapEditor:photosCount", {
                    count: photoSession.photos.length,
                    max: LIMITS.maxPhotos,
                  })}
                >
                  {photoSession.photos.length} / {LIMITS.maxPhotos}
                </span>
              </div>

              <p class="mt-1 text-xs opacity-50">
                {$i18n.t("ui:map:mapEditor:photosHint", { max: LIMITS.maxPhotos })}
              </p>

              {#if photoSession.photos.length > 0}
                <div class="mt-2 flex flex-wrap gap-2">
                  {#each photoSession.photos as path, index (path)}
                    <div class="relative size-20 overflow-hidden rounded-lg">
                      <!-- Tap a photo to make it the cover (a no-op on the current cover) -->
                      <button
                        type="button"
                        class="block size-full"
                        aria-label={$i18n.t("ui:map:mapEditor:photosSetCover")}
                        onclick={() => photoSession.setCover(path)}
                      >
                        <PhotoThumb {path} class="size-full object-cover" />
                      </button>

                      {#if index === 0}
                        <span
                          class="pointer-events-none absolute inset-x-0 bottom-0 bg-black/60 px-1
                                 text-center text-[10px] text-white"
                        >
                          {$i18n.t("ui:map:mapEditor:photosCover")}
                        </span>
                      {/if}

                      <button
                        type="button"
                        class="absolute right-1 top-1 flex size-6 items-center
                             justify-center rounded-full bg-black/60 text-white"
                        aria-label={$i18n.t("ui:map:mapEditor:photosRemove")}
                        onclick={() => photoSession.remove(path)}
                      >
                        <Close className="size-3.5" />
                      </button>
                    </div>
                  {/each}
                </div>
              {/if}

              <Button
                small
                rounded
                outline
                class="mt-3"
                disabled={!photoSession.canAdd}
                onClick={() => (isActionsOpened = true)}
              >
                {$i18n.t("ui:map:mapEditor:photosAdd")}
              </Button>
            </div>
          {/snippet}
        </ListItem>

        <ListButton onClick={handleSave}>
          {isEditing ? $i18n.t("ui:map:mapEditor:update") : $i18n.t("ui:map:mapEditor:save")}
        </ListButton>

        <ListButton onClick={handleClose}>
          {$i18n.t("ui:map:mapEditor:cancel")}
        </ListButton>
      </List>
    </Block>
  </article>
</Sheet>

<!-- Choice of the photo source. Must stay after the Sheet (see below) -->
<Actions opened={isActionsOpened} onBackdropClick={() => (isActionsOpened = false)}>
  <ActionsGroup>
    <ActionsButton onClick={() => handlePick("camera")}>
      {$i18n.t("ui:map:mapEditor:photosTake")}
    </ActionsButton>
    <ActionsButton onClick={() => handlePick("gallery")}>
      {$i18n.t("ui:map:mapEditor:photosChoose")}
    </ActionsButton>
  </ActionsGroup>
  <ActionsGroup>
    <ActionsButton bold onClick={() => (isActionsOpened = false)}>
      {$i18n.t("ui:map:mapEditor:cancel")}
    </ActionsButton>
  </ActionsGroup>
</Actions>

<!-- Delete confirmation. Must stay after the Sheet: both have the same z-index, so the later one is on top -->
<Dialog opened={isDeleteDialogOpened}>
  {#snippet title()}
    <h1>{$i18n.t("ui:map:mapEditor:deleteTitle")}</h1>
  {/snippet}

  <p>{$i18n.t("ui:map:mapEditor:deleteMessage")}</p>

  {#snippet buttons()}
    <DialogButton onClick={handleDeleteCancel}>
      {$i18n.t("ui:map:mapEditor:cancel")}
    </DialogButton>
    <DialogButton strong onClick={handleDeleteConfirm}>
      {$i18n.t("ui:map:mapEditor:delete")}
    </DialogButton>
  {/snippet}
</Dialog>
