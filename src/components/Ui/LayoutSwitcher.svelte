<script>
  /**
   * Layout Switcher subcomponent
   */

  import { onMount } from "svelte";

  // KonstaUI import
  import { List, ListButton, Button, Icon } from "konsta/svelte";

  // icons import
  import LayoutGridIcon from "@/components/Lib/Icons/LayoutGridIcon.svelte";
  import LayoutRowsIcon from "@/components/Lib/Icons/LayoutRowsIcon.svelte";

  // i18Next
  import { i18nStores } from "@/services/i18n";
  const { i18n } = i18nStores;

  // Props
  let { onChange = null, onDone = null } = $props();

  // ui tailwind classes
  const baseBtnClasses =
    "flex justify-between items-center h-13 text-[17px] k-list-button relative px-4 gap-1 w-full duration-300 active:duration-0 focus:outline-none touch-ripple-primary overflow-hidden select-none ios";

  const activeBtnClasses = "bg-primary/10 text-primary font-bold";
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

  // Local Storage helpers
  function setLocalStorage(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      console.warn("localStorage set failed", error);
    }
  }

  function getLocalStorage(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      console.warn("localStorage get failed", error);
      return null;
    }
  }

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
      if (typeof onDone === "function") onDone();
      return;
    }

    // Update state
    applyLayout(switcherId);
    if (typeof onDone === "function") onDone();
  };

  // $inspect({ layoutMode, layoutState });
</script>

<p class="pl-5 pr-5 mt-6 text-right text-xl text-gray-900 dark:text-gray-900">
  {$i18n.t("ui:popover:layoutTitle")}
</p>

<List strong inset>
  {#each listCollection as list (list.id)}
    <ListButton
      linkProps={{
        class: getBtnClasses(list.id),
        "data-switcher-id": list.id,
      }}
      onclick={(e) => layoutSwitcherHandler(e)}
    >
      <Icon>
        {@const IconComponent = list.icon}
        <IconComponent />
      </Icon>

      <span> {$i18n.t(`ui:popover:${list.id}`)} </span>
    </ListButton>
  {/each}
</List>
