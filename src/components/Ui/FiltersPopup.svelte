<script>
  /**
   * General component from handbook filters
   */

  import { onMount } from "svelte";

  import { Popover, Button, Icon } from "konsta/svelte";
  import LayoutSwitcher from "./LayoutSwitcher.svelte";

  import FilterIcon from "@/components/Lib/Icons/FilterIcon.svelte";

  // i18Next
  import { i18nStores } from "@/services/i18n";
  const { i18n } = i18nStores;

  // Props (Handbook<-FiltersPopup<-LayoutSwitcher)
  let { onChange = null } = $props();

  // Popover logic
  let popoverState = $state(false);
  let popoverTargetEl = $state(null);

  const popoverClickHandler = (targetEl) => {
    popoverTargetEl = targetEl;
    popoverState = true;
  };

  // Universal close function
  const closePopover = () => {
    popoverState = false;
  };

  const backdropClickHandler = closePopover;
</script>

<Button
  roundedIos
  smallIos
  class="popover-button inline-flex w-auto"
  onclick={() => popoverClickHandler(".popover-button")}
>
  <Icon>
    <FilterIcon className="w-5 h-5" />
  </Icon>
</Button>

<Popover opened={popoverState} target={popoverTargetEl} onBackdropClick={backdropClickHandler}>
  <!-- Layout Switcher component  -->
  <LayoutSwitcher {onChange} onDone={closePopover} />
</Popover>
