<script>
  import { Dialog, DialogButton } from "konsta/svelte";

  let { i18n, openedDialog, closeDialog, confirmDialog } = $props();
</script>

<Dialog opened={openedDialog}>
  {#snippet title()}
    {$i18n.t("ui:dialog:map:newRoute:title")}
  {/snippet}

  {#snippet buttons()}
    <DialogButton strong onClick={closeDialog}>
      {$i18n.t("ui:dialog:map:newRoute:no")}
    </DialogButton>

    <DialogButton onClick={confirmDialog}>
      {$i18n.t("ui:dialog:map:newRoute:yes")}
    </DialogButton>
  {/snippet}
</Dialog>
