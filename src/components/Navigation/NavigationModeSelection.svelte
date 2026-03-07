<script>
  import { Button } from "konsta/svelte";
  import GPSIcon from "@/lib/icons/GPSIcon.svelte";
  import RoutingNavigationIcon from "@/lib/icons/RoutingNavigationIcon.svelte";

  let { i18n, isAnyModeActive, onToggle, onGPSToggle } = $props();
</script>

<article class="flex flex-row gap-2">
  <!-- Point-to-Point Navigation -->
  <Button inline roundedIos class="k-color-brand-blue text-[16px]" onClick={onToggle}>
    <RoutingNavigationIcon className="size-8 mr-2" />
    <span>{$i18n.t("ui:map:nav:pointToPoint")}</span>
  </Button>

  <!-- GPS Navigation -->
  <Button inline roundedIos class="k-color-brand-blue text-[16px]" onClick={onGPSToggle}>
    <GPSIcon className="size-8 mr-2" />

    <span>
      {$i18n.t("ui:map:gps:navigate")}
    </span>
  </Button>
</article>
