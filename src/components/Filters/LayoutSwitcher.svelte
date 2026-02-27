<script>
  /**
   * Layout Switcher subcomponent
   */

  // KonstaUI import
  import { List, ListButton, Icon, BlockTitle } from "konsta/svelte";
  import { layoutView } from "@/store/ui/layoutView";

  // icons import
  import LayoutGridIcon from "@/lib/icons/LayoutGridIcon.svelte";
  import LayoutRowsIcon from "@/lib/icons/LayoutRowsIcon.svelte";

  // Props
  let { i18n } = $props();

  // Layout state (from global store)
  let layout = $state(null);

  $effect(() => {
    return layoutView.subscribe((v) => (layout = v));
  });

  // ui tailwind classes
  const baseBtnClasses =
    "flex items-center cursor-pointer h-13 text-[17px] k-list-button relative px-4 gap-1 w-full duration-300 active:duration-0 focus:outline-none touch-ripple-primary overflow-hidden select-none ios";

  const activeBtnClasses = "rounded-full bg-primary/10 text-primary font-bold";
  const inactiveBtnClasses = "text-black dark:text-white active-primary/15";

  // Utils: the final className constructor
  /* prettier-ignore */
  function getBtnClasses(id) {
    return layout?.mode === id
      ? `${baseBtnClasses} ${activeBtnClasses}`
      : `${baseBtnClasses} ${inactiveBtnClasses}`
  }

  // Layout options
  const listCollection = [
    {
      id: "layoutGrid",
      icon: LayoutGridIcon,
    },
    {
      id: "layoutRows",
      icon: LayoutRowsIcon,
    },
  ];

  // Layout switcher
  function switchLayout(id) {
    if (!layout || layout.mode === id) return;
    layoutView.set(id);
  }
</script>

<BlockTitle>{$i18n.t("ui:sidePanel:handbook:filters:layoutTitle")}</BlockTitle>

<List inset>
  {#each listCollection as item (item.id)}
    <ListButton
      linkProps={{
        class: getBtnClasses(item.id),
        "data-switcher-id": item.id,
      }}
      onclick={() => switchLayout(item.id)}
    >
      <Icon class="me-4">
        {@const IconComponent = item.icon}
        <IconComponent className="w-5 h-5" />
      </Icon>

      <span> {$i18n.t(`ui:sidePanel:handbook:filters:${item.id}`)} </span>
    </ListButton>
  {/each}
</List>
