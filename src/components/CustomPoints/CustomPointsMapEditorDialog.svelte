<script>
  import { untrack } from "svelte";
  import Close from "@/lib/icons/Close.svelte";
  import { errorToast } from "@/store/ui/errorToast";
  import { createLogger, IS_DEBUG } from "@/utils/debugMode";
  import { Block, BlockTitle, Link, List, ListButton, ListInput, Sheet, Toolbar, ToolbarPane } from "konsta/svelte";

  // editingPoint - custom point to update, null/undefined when a new point is being created
  let { i18n, coords, opened, editingPoint, onCloseModal, onSave } = $props();

  const modalLogger = createLogger("CustomPointsMapEditorDialog");

  // TODO: move to translations
  const EDIT_TITLE = "Обновить данные";
  const EDIT_SAVE_LABEL = "Обновить";

  let title = $state("");
  let description = $state("");

  const isEditing = $derived(Boolean(editingPoint));

  // Fill the form with the data of the point every time the dialog is opened for editing
  $effect(() => {
    if (!opened || !editingPoint) return;

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
</script>

<Sheet class="pb-safe" {opened}>
  <Toolbar top innerClass="w-full items-center" class="justify-end ios:pt-4">
    <div class="ios:hidden"></div>

    <span class="text-xl font-bold text-stone-600 dark:text-stone-300">
      {isEditing ? $i18n.t("ui:map:mapEditor:modalTitleUpdates") : $i18n.t("ui:map:mapEditor:modalTitleCreate")}
    </span>

    <div class="flex flex-row gap-2">
      <ToolbarPane>
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
