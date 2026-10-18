<script>
  /**
   * "Import markers?" confirmation: what the picked file would add and update, before anything is
   * saved. Presentational — CustomPointsTransfer owns the open state (an overlay toggle, so Android
   * back cancels) and the counts (customPointsState.previewImport).
   */
  import { Dialog, DialogButton } from "konsta/svelte";

  let {
    i18n,
    opened = false,
    /** @type {{ added: number, updated: number, unchanged: number, skipped: number } | null} */
    preview = null,
    onConfirm,
    onCancel,
  } = $props();
</script>

<Dialog {opened} onBackdropClick={onCancel}>
  {#snippet title()}
    {$i18n.t("ui:settings:customPoints:importDialog:title")}
  {/snippet}

  {#if preview}
    <ul class="space-y-1">
      {#if preview.added > 0}
        <li>{$i18n.t("ui:settings:customPoints:importDialog:willAdd", { count: preview.added })}</li>
      {/if}
      {#if preview.updated > 0}
        <li>{$i18n.t("ui:settings:customPoints:importDialog:willUpdate", { count: preview.updated })}</li>
      {/if}
      {#if preview.unchanged > 0}
        <li class="opacity-70">
          {$i18n.t("ui:settings:customPoints:importDialog:unchanged", { count: preview.unchanged })}
        </li>
      {/if}
      {#if preview.skipped > 0}
        <li class="opacity-70">
          {$i18n.t("ui:settings:customPoints:importSkipped", { skipped: preview.skipped })}
        </li>
      {/if}
    </ul>

    {#if preview.updated > 0}
      <p class="mt-3 text-sm opacity-70">{$i18n.t("ui:settings:customPoints:importDialog:photosKept")}</p>
    {/if}
  {/if}

  {#snippet buttons()}
    <DialogButton onClick={onCancel}>
      {$i18n.t("ui:settings:customPoints:importDialog:cancel")}
    </DialogButton>
    <DialogButton strong onClick={onConfirm}>
      {$i18n.t("ui:settings:customPoints:importDialog:confirm")}
    </DialogButton>
  {/snippet}
</Dialog>
