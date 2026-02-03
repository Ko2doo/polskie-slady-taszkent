<script>
  import DangerTriangleIcon from "@/lib/icons/DangerTriangleIcon.svelte";
  import { Toast, Button } from "konsta/svelte";
  import { errorToast } from "@/store/ui/errorToast";

  let { i18n } = $props();

  function onButton() {
    errorToast.hide();
  }
</script>

<Toast opened={$errorToast.opened} class="bottom-safe-24" position="center">
  {#snippet button()}
    <Button clear inline small rounded onClick={onButton}>
      {$i18n.t("errors:toastBtn")}
    </Button>
  {/snippet}

  <div class="shrink flex items-start">
    <DangerTriangleIcon className="flex flex-[0_0_auto] size-10 text-red-500" />

    <div class="min-w-0 pl-2">
      <p>{$errorToast.content}</p>

      {#if $errorToast.meta?.scope || $errorToast.meta?.code}
        <code class="text-xs opacity-60 mt-1">
          {#if $errorToast.meta?.scope}{`Name: ${$errorToast.meta.scope}`}{/if}

          {#if $errorToast.meta?.code}
            {#if $errorToast.meta?.scope}
              ·
            {/if}
            {`Code: ${$errorToast.meta.code}`}
          {/if}
        </code>
      {/if}
    </div>
  </div>
</Toast>
