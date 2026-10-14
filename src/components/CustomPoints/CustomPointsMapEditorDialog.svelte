<script>
  import { untrack } from "svelte";
  import Close from "@/lib/icons/Close.svelte";
  import TrashBinIcon from "@/lib/icons/TrashBinIcon.svelte";
  import { errorToast } from "@/store/ui/errorToast";
  import { createLogger, IS_DEBUG } from "@/utils/debugMode";
  import {
    Block,
    BlockTitle,
    Dialog,
    DialogButton,
    Link,
    List,
    ListButton,
    ListInput,
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

  // Edit mode of the dialog. It is updated only while the dialog is open, so the texts and the delete button
  // do not switch to the "create" state during the closing animation (e.g. right after the point was deleted)
  let isEditing = $state(false);

  // Fill the form with the data of the point every time the dialog is opened
  $effect(() => {
    if (!opened) return;

    isEditing = Boolean(editingPoint);

    if (!editingPoint) return;

    // Only `opened` and `editingPoint` must trigger this effect, not the fields of the point
    untrack(() => {
      title = editingPoint.title;
      description = editingPoint.description;
    });
  });

  const coordsLabel = $derived.by(() => {
    if (!coords) return "";

    return `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
  });

  function resetForm() {
    title = "";
    description = "";
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
    });

    // If saving failed, keep the entered data
    if (isSaved) {
      resetForm();
    }
  }

  function handleClose() {
    resetForm();
    onCloseModal();
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
      resetForm();
    } else {
      IS_DEBUG && modalLogger.error("Failed to delete the point");

      errorToast.error("Failed to delete the point. Please try again.", {
        scope: "CustomPointsMapEditorDialog",
      });
    }
  }
</script>

<Sheet class="pb-safe" {opened}>
  <Toolbar top innerClass="w-full items-center" class="justify-end ios:pt-4">
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
        required
      />
      <ListInput
        bind:value={description}
        label={$i18n.t("ui:map:mapEditor:description")}
        floatingLabel
        type="textarea"
        placeholder={$i18n.t("ui:map:mapEditor:descriptionPlaceholder")}
        required
      />

      <ListButton onClick={handleSave}>
        {isEditing ? $i18n.t("ui:map:mapEditor:update") : $i18n.t("ui:map:mapEditor:save")}
      </ListButton>

      <ListButton onClick={handleClose}>
        {$i18n.t("ui:map:mapEditor:cancel")}
      </ListButton>
    </List>
  </Block>
</Sheet>

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
