<script>
  /**
   * Language switcher component
   */

  import { Popover, List, ListButton, Button } from "konsta/svelte";

  import { translations } from "@/locales/collections";

  let { i18n } = $props();

  let popoverState = $state(false);
  let popoverTargetEl = $state(null);

  const popoverClickHandler = (targetEl) => {
    popoverTargetEl = targetEl;
    popoverState = true;
  };

  const backdropClickHandler = () => (popoverState = false);

  // Keyed rendering
  const locales = Object.entries(translations);
  // console.log(locales);

  const i18nClickHandler = () => {
    let eventTarget = event.target.value;
    // console.log(`Changed: ${eventTarget}`);

    if (eventTarget !== undefined) {
      $i18n.changeLanguage(eventTarget);
      backdropClickHandler();
    }
  };
</script>

<Button rounded class="popover-button" onClick={() => popoverClickHandler(".popover-button")}>
  {$i18n.t("ui:buttons:langSwitcher")}
</Button>

<Popover opened={popoverState} target={popoverTargetEl} onBackdropClick={backdropClickHandler}>
  <List strong inset>
    {#each locales as [code, label]}
      <ListButton colors={{ bgIos: "active:bg-neutral-600/10" }} value={code} onClick={i18nClickHandler}>
        {label}
      </ListButton>
    {/each}
  </List>
</Popover>
