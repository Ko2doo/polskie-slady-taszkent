<script>
  import { errorToast } from "@/store/ui/errorToast";
  import { createLogger, IS_DEBUG } from "@/utils/debugMode";
  import { Dialog, DialogButton } from "konsta/svelte";

  let { i18n, openedDialog, onConfirm } = $props();

  const dialogLogger = createLogger("CustomPointsDialog");

  async function dialogCompleted() {
    try {
      await onConfirm();

      IS_DEBUG && dialogLogger.log("Dialog completed");
    } catch (error) {
      IS_DEBUG && dialogLogger.error("Failed to complete dialog:", error);

      errorToast.error($i18n.t("errors:settingsSaveFailed"), {
        scope: "CustomPointsDialog",
      });
    }
  }
</script>

<Dialog opened={openedDialog}>
  {#snippet title()}
    <h1>{$i18n.t("ui:map:userCustomPoints:message")}</h1>
  {/snippet}

  <p>{$i18n.t("ui:map:userCustomPoints:instruction")}</p>

  {#snippet buttons()}
    <DialogButton strong onClick={dialogCompleted}>
      {$i18n.t("ui:map:userCustomPoints:dialogButton")}
    </DialogButton>
  {/snippet}
</Dialog>
