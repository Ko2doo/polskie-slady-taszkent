<script>
  /**
   * Layout Switcher subcomponent
   */

  import { onMount } from "svelte";

  // KonstaUI import
  import { List, ListButton, Icon, BlockTitle } from "konsta/svelte";

  // icons import
  import LayoutGridIcon from "@/lib/icons/LayoutGridIcon.svelte";
  import LayoutRowsIcon from "@/lib/icons/LayoutRowsIcon.svelte";

  // Utils
  import { setLocalStorage, getLocalStorage } from "@/utils/localeStorageUtils";

  // Props
  let { i18n, onChange = null } = $props();

  // ui tailwind classes
  const baseBtnClasses =
    "flex items-center cursor-pointer h-13 text-[17px] k-list-button relative px-4 gap-1 w-full duration-300 active:duration-0 focus:outline-none touch-ripple-primary overflow-hidden select-none ios";

  const activeBtnClasses = "rounded-full bg-primary/10 text-primary font-bold";
  const inactiveBtnClasses = "text-gray-600 active-primary/15";

  // Utils: the final className constructor
  function getBtnClasses(listId) {
    return listId === layoutMode ? `${baseBtnClasses} ${activeBtnClasses}` : `${baseBtnClasses} ${inactiveBtnClasses}`;
  }

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

  // Layout switcher logic
  const BASE_GRID_STYLE = "grid";
  const GRID_STYLE = `${BASE_GRID_STYLE} grid-cols-2 lg:grid-cols-4 md:grid-cols-3`;
  const ROWS_STYLE = `${BASE_GRID_STYLE} grid-cols-1 md:grid-cols-1`;

  // localStorage key name
  const LS_KEY = "handbook.layoutMode";

  // State
  let layoutMode = $state("layoutGrid"); // by default
  let layoutState = $state(GRID_STYLE);

  // emit "change" event
  function emitChange() {
    if (typeof onChange === "function") {
      onChange({
        mode: layoutMode, // 'layoutGrid' | 'layoutRows'
        classes: layoutState,
      });
    }
  }

  // applyLayout(mode)
  // Normalized value
  // updates two reactive state
  // writting to localStorage
  function applyLayout(mode) {
    const normalized = mode === "layoutRows" || mode === "layoutGrid" ? mode : "layoutGrid";

    layoutMode = normalized;
    layoutState = normalized === "layoutRows" ? ROWS_STYLE : GRID_STYLE;

    setLocalStorage(LS_KEY, normalized);
    emitChange();
  }

  // Initialization for mount component
  onMount(() => {
    const stored = getLocalStorage(LS_KEY);
    applyLayout(stored);
  });

  // Click handler
  const layoutSwitcherHandler = (event) => {
    // const eventTarget = event.target;
    const switcherId = event.currentTarget?.dataset?.switcherId;
    if (!switcherId) return;

    // Double-click protection
    if (switcherId === layoutMode) {
      return;
    }

    // Update state
    applyLayout(switcherId);
  };

  // $inspect({ layoutMode, layoutState });
</script>

<BlockTitle>{$i18n.t("ui:sidePanel:handbook:filters:layoutTitle")}</BlockTitle>

<List inset>
  {#each listCollection as list (list.id)}
    <ListButton
      linkProps={{
        class: getBtnClasses(list.id),
        "data-switcher-id": list.id,
      }}
      onclick={(e) => layoutSwitcherHandler(e)}
    >
      <Icon class="me-4">
        {@const IconComponent = list.icon}
        <IconComponent className="w-5 h-5" />
      </Icon>

      <span> {$i18n.t(`ui:sidePanel:handbook:filters:${list.id}`)} </span>
    </ListButton>
  {/each}
</List>
