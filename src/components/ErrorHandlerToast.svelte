<script>
  import DangerTriangleIcon from "@/lib/icons/DangerTriangleIcon.svelte";
  import { Toast, Button } from "konsta/svelte";
  import { errorToast } from "@/store/ui/errorToast";
  import { createLogger, IS_DEBUG } from "@/utils/debugMode";

  let { i18n } = $props();

  const ErrHandlerToastLogger = createLogger("ErrorHandlerToast");

  function onButton() {
    errorToast.hide();
  }

  async function onActionButton() {
    const action = $errorToast.meta?.action;

    if (!action || typeof action.handler !== "function") {
      IS_DEBUG && ErrHandlerToastLogger.warn("No valid action handler");
      return;
    }

    try {
      await action.handler();

      errorToast.hide();
    } catch (error) {
      IS_DEBUG && ErrHandlerToastLogger.error("Action handler failed:", error);
    }
  }

  function onCloseButton() {
    errorToast.hide();
  }
</script>

<Toast opened={$errorToast.opened} class="bottom-safe-24" position="center">
  {#snippet button()}
    <div class="flex flex-col gap-2">
      <!-- Action button (if present) -->
      {#if $errorToast.meta?.action}
        <Button clear inline small rounded onClick={onActionButton}>
          {$errorToast.meta.action.label}
        </Button>
      {:else}
        <!-- Close button -->
        <Button clear inline small rounded onClick={onCloseButton}>
          {$i18n.t("errors:toastBtn")}
        </Button>
      {/if}
    </div>
  {/snippet}

  <div class="shrink flex items-start">
    <DangerTriangleIcon className="flex flex-[0_0_auto] size-10 text-red-500" />

    <div class="min-w-0 pl-2">
      <p>{$errorToast.content}</p>

      {#if $errorToast.meta?.scope || $errorToast.meta?.code}
        <code class="text-xs opacity-60 mt-1">
          {#if $errorToast.meta?.scope}{`Name: ${$errorToast.meta.scope}`}{/if}

          {#if $errorToast.meta?.code}
            {`Code: ${$errorToast.meta.code}`}
          {/if}
        </code>
      {/if}
    </div>
  </div>
</Toast>
