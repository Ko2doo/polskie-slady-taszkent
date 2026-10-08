<script>
  import { Button } from "konsta/svelte";
  import GPSIcon from "@/lib/icons/GPSIcon.svelte";
  import RulerIcon from "@/lib/icons/RulerIcon.svelte";

  let { i18n, isAnyModeActive, onToggle, onGPSToggle } = $props();
</script>

<section class="navigation-mode-selector">
  <!-- Point-to-Point Navigation -->
  <Button inline roundedIos class="k-color-brand-blue text-[16px]" onClick={onToggle}>
    <RulerIcon className="size-6 mr-2" />
    <span>{$i18n.t("ui:map:nav:pointToPoint")}</span>
  </Button>

  <!-- GPS Navigation -->
  <Button inline roundedIos class="k-color-brand-blue text-[16px]" onClick={onGPSToggle}>
    <GPSIcon className="size-6 mr-2" />

    <span>
      {$i18n.t("ui:map:gps:navigate")}
    </span>
  </Button>
</section>

<style>
  .navigation-mode-selector {
    width: 100%;

    display: flex;
    flex-wrap: nowrap;

    gap: 12px;

    scroll-behavior: auto;
    scrollbar-width: none;

    overflow-x: scroll;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .navigation-mode-selector > :global(*) {
    flex-shrink: 0;
    white-space: nowrap;
  }
</style>
