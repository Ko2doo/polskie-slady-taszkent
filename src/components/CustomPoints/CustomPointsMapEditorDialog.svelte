<script>
  import Close from "@/lib/icons/Close.svelte";
  import { errorToast } from "@/store/ui/errorToast";
  import { createLogger, IS_DEBUG } from "@/utils/debugMode";
  import { Block, BlockTitle, Link, List, ListButton, ListInput, Sheet, Toolbar, ToolbarPane } from "konsta/svelte";

  let { i18n, coords, opened, onCloseModal } = $props();

  const modalLogger = createLogger("CustomPointsDialog");

  const coordsLabel = $derived.by(() => {
    if (!coords) return "";

    return `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
  });
</script>

<Sheet class="pb-safe" {opened} onBackdropClick={false}>
  <Toolbar top innerClass="w-full items-center" class="justify-end ios:pt-4">
    <div class="ios:hidden"></div>

    <span class="text-xl font-bold text-stone-600 dark:text-stone-300">
      {$i18n.t("ui:map:mapEditor:modalWindow")}
    </span>

    <div class="flex flex-row gap-2">
      <ToolbarPane>
        <Link class="p-2" iconOnly onClick={onCloseModal}>
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
        label={$i18n.t("ui:map:mapEditor:title")}
        floatingLabel
        type="text"
        placeholder={$i18n.t("ui:map:mapEditor:titlePlaceholder")}
        required
      />
      <ListInput
        label={$i18n.t("ui:map:mapEditor:description")}
        floatingLabel
        type="text"
        placeholder={$i18n.t("ui:map:mapEditor:descriptionPlaceholder")}
        required
      />

      <ListButton>
        {$i18n.t("ui:map:mapEditor:save")}
      </ListButton>

      <ListButton onClick={onCloseModal}>
        {$i18n.t("ui:map:mapEditor:cancel")}
      </ListButton>
    </List>
  </Block>
</Sheet>
