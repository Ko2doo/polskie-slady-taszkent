<script>
  /**
   * The "My markers" block of Settings: export every custom point to a file (the system share sheet
   * on a device, a download in the browser) and import a file picked on the phone. Wires the points
   * state (exportFile / previewImport / importFile) to the file transfer
   * (services/customPointsTransfer.js).
   *
   * An import goes in two steps: the file is checked and merged on trial first, and the user
   * confirms what it would add and update (CustomPointsImportDialog) before anything is saved.
   * While a step runs, a spinner says which one. Every outcome the user should hear about goes
   * through errorToast.
   */
  import { tick } from "svelte";
  import { BlockTitle, Button, Preloader } from "konsta/svelte";

  import MapEditor from "@/lib/icons/MapEditor.svelte";
  import CustomPointsImportDialog from "./CustomPointsImportDialog.svelte";
  import { customPointsState } from "@/lib/state/customPointsState.svelte.js";
  import { createToggleOverlay } from "@/lib/state/createToggleOverlay";
  import { ERROR_CODES } from "@/lib/errors/errorCodes";
  import { LIMITS } from "@/services/customPointsFormat";
  import { EXPORT_MIME_TYPE, deliverExportFile, readImportFile } from "@/services/customPointsTransfer";
  import { errorToast } from "@/store/ui/errorToast";
  import { createLogger, IS_DEBUG } from "@/utils/debugMode";

  let { i18n } = $props();

  const transferLogger = createLogger("CustomPointsTransfer");
  const TOAST_SCOPE = "CustomPointsTransfer";

  // Why a file was refused (readImportFile / customPointsState) → what the user reads
  const REFUSAL_TEXT_KEYS = {
    tooLarge: "errors:customPointsImportTooLarge",
    tooManyPoints: "errors:customPointsImportTooManyPoints",
    invalidJson: "errors:customPointsImportNotPoints",
    unknownFormat: "errors:customPointsImportNotPoints",
    invalidFile: "errors:customPointsImportNotPoints",
    checksumMismatch: "errors:customPointsImportDamaged",
    unsupportedVersion: "errors:customPointsImportNewerVersion",
    unreadable: "errors:customPointsImportUnreadable",
  };

  // The step running now: "exporting" | "checking" | "importing", null when idle
  let phase = $state(null);
  const isBusy = $derived(phase !== null);

  let fileInput = $state(null);

  // The checked file waiting for the user's confirmation, and what it would do
  const importDialog = createToggleOverlay();
  let pendingText = null;
  let preview = $state(null);

  // Leaving Settings with the dialog open must not leave it on the back-button stack
  $effect(() => () => importDialog.close());

  // However the dialog closes (Android back included), the checked file is let go
  $effect(() => {
    if (!importDialog.value) forgetPendingImport();
  });

  /**
   * Show the spinner before a long synchronous step (parsing a big file) blocks the thread:
   * the DOM update first, then one macrotask so the browser can paint it
   * @param {"exporting"|"checking"|"importing"} nextPhase - the step about to run
   * @returns {Promise<void>}
   */
  async function startPhase(nextPhase) {
    phase = nextPhase;
    await tick();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  async function exportPoints() {
    await startPhase("exporting");
    try {
      const { text, count } = await customPointsState.exportFile();
      if (count === 0) {
        errorToast.info($i18n.t("ui:settings:customPoints:nothingToExport"), { scope: TOAST_SCOPE });
        return;
      }

      await deliverExportFile(text, {
        title: $i18n.t("ui:settings:customPoints:shareTitle"),
        dialogTitle: $i18n.t("ui:settings:customPoints:shareDialogTitle"),
      });
    } catch (error) {
      IS_DEBUG && transferLogger.error("Export failed:", error);
      errorToast.error($i18n.t("errors:customPointsExportFailed"), {
        scope: TOAST_SCOPE,
        code: ERROR_CODES.POINTS_EXPORT_FAILED,
      });
    } finally {
      phase = null;
    }
  }

  function showRefusal(reason) {
    const key = REFUSAL_TEXT_KEYS[reason] ?? REFUSAL_TEXT_KEYS.invalidFile;
    errorToast.error($i18n.t(key, { max: LIMITS.maxPoints }), {
      scope: TOAST_SCOPE,
      code: ERROR_CODES.POINTS_IMPORT_REFUSED,
    });
  }

  function showSummary({ added, updated, unchanged, skipped }) {
    const done = $i18n.t("ui:settings:customPoints:importDone", { added, updated, unchanged });
    const text = skipped > 0 ? `${done} ${$i18n.t("ui:settings:customPoints:importSkipped", { skipped })}` : done;
    errorToast.info(text, { scope: TOAST_SCOPE });
  }

  /**
   * Step 1: read and check the picked file, then ask — or say there's nothing new in it
   * @param {Event} event - the file input's change
   */
  async function checkPickedFile(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    // Cleared at once, so picking the same file again fires a change again
    input.value = "";

    await startPhase("checking");
    try {
      const read = await readImportFile(file);
      if (!read.ok) {
        // No file: the user closed the chooser — nothing to say
        if (read.reason !== "noFile") showRefusal(read.reason);
        return;
      }

      const result = await customPointsState.previewImport(read.text);
      if (!result.ok) {
        showRefusal(result.reason);
        return;
      }

      if (result.added + result.updated === 0) {
        errorToast.info($i18n.t("ui:settings:customPoints:nothingNew"), { scope: TOAST_SCOPE });
        return;
      }

      pendingText = read.text;
      preview = result;
      importDialog.open();
    } catch (error) {
      IS_DEBUG && transferLogger.error("Import check failed:", error);
      showRefusal("unreadable");
    } finally {
      phase = null;
    }
  }

  function forgetPendingImport() {
    pendingText = null;
    preview = null;
  }

  function cancelImport() {
    importDialog.close();
    forgetPendingImport();
  }

  /**
   * Step 2: the user confirmed — import for real
   */
  async function confirmImport() {
    const text = pendingText;
    importDialog.close();
    forgetPendingImport();
    if (text === null) return;

    await startPhase("importing");
    try {
      const result = await customPointsState.importFile(text);
      if (result.ok) {
        showSummary(result);
      } else {
        showRefusal(result.reason);
      }
    } catch (error) {
      IS_DEBUG && transferLogger.error("Import failed:", error);
      showRefusal("unreadable");
    } finally {
      phase = null;
    }
  }
</script>

<BlockTitle medium class="justify-baseline">
  <MapEditor className="size-8" fillColor="currentColor" />

  <span class="ml-4">
    {$i18n.t("ui:settings:customPoints:title")}
  </span>
</BlockTitle>

<div class="mt-4 px-4 pb-4">
  <p class="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
    {$i18n.t("ui:settings:customPoints:hint")}
  </p>
</div>

<div class="flex gap-2">
  <Button raised rounded small disabled={isBusy} onClick={exportPoints}>
    {$i18n.t("ui:settings:customPoints:export")}
  </Button>

  <Button raised rounded small disabled={isBusy} onClick={() => fileInput.click()}>
    {$i18n.t("ui:settings:customPoints:import")}
  </Button>
</div>

<!-- What runs now: a spinner with its name, read out by screen readers as it changes -->
<div class="flex items-center gap-3 px-4 pt-3 min-h-10" role="status" aria-live="polite">
  {#if phase}
    <Preloader class="size-6" />
    <span class="text-sm text-gray-500 dark:text-gray-400">
      {$i18n.t(`ui:settings:customPoints:progress:${phase}`)}
    </span>
  {/if}
</div>

<!-- The WebView opens the system file chooser for it; the visible button above stands in for it -->
<input
  bind:this={fileInput}
  type="file"
  accept={`${EXPORT_MIME_TYPE},.json`}
  class="hidden"
  aria-hidden="true"
  tabindex="-1"
  onchange={checkPickedFile}
/>

<CustomPointsImportDialog
  {i18n}
  opened={importDialog.value}
  {preview}
  onConfirm={confirmImport}
  onCancel={cancelImport}
/>
