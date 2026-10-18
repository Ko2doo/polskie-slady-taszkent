<script>
  import { onDestroy } from "svelte";
  import { Toast } from "konsta/svelte";
  import { exitToast, toastController } from "@/services/toastController";

  let { i18n } = $props();

  // How often to update countdown (in ms)
  const TICK_MS = 100;

  let opened = $state(false);
  let remainingMs = $state(0);
  let totalMs = $state(0);

  let timerId = null;

  function clearTimer() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  // Main effect: reacts to ANY change in exitToast store.
  // When:
  //   - opened becomes true
  //   - or version changes
  // we restart the countdown.
  $effect(() => {
    const state = $exitToast;

    opened = state.opened;
    totalMs = state.durationMs ?? 3000;

    // Clean up any previous timer before starting a new one.
    clearTimer();

    // If toast is not opened -> reset countdown and do nothing.
    if (!opened) {
      remainingMs = 0;
      return;
    }

    // Toast is opened -> start (or restart) countdown.
    remainingMs = totalMs;

    timerId = setInterval(() => {
      remainingMs -= TICK_MS;

      if (remainingMs <= 0) {
        remainingMs = 0;
        clearTimer();
        toastController.hide();
      }
    }, TICK_MS);
  });

  // Reset countdown when user clicks on the toast:
  // - we call showExitToast() again with the same duration
  // - this increments "version" and re-triggers the effect above,
  //   which restarts the timer.
  function handleClick() {
    if (!opened) return;
    toastController.showExitToast(totalMs);
  }

  onDestroy(clearTimer);
</script>

<Toast {opened} class="bottom-safe-24" position="center" button={false} onclick={() => handleClick()}>
  <div class="flex items-center gap-2 shrink">
    <span class="text-md">{$i18n.t("ui:toasts:exitApp")}</span>

    <span class="ml-auto text-xs opacity-80 tabular-nums">
      {Math.ceil(remainingMs / 1000)}s
    </span>
  </div>
</Toast>
