<script>
  import { writable } from "svelte/store";
  import { Popover, List, ListButton, Button } from "konsta/svelte";

  import { i18nStores } from "../../services/i18n";
  import { translations } from "../../locales/collections";

  const { i18n } = i18nStores;

  let popoverState = writable(false);
  let popoverTargetEl = null;

  const popoverClickHandler = (targetEl) => {
    popoverTargetEl = targetEl;
    popoverState.set(true);
  };

  const backdropClickHandler = () => popoverState.set(false);

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

<Button rounded class="popover-button" onclick={() => popoverClickHandler(".popover-button")}>
  {$i18n.t("ui:langSwitcher:label")}
</Button>

<Popover opened={$popoverState} target={popoverTargetEl} onBackdropClick={backdropClickHandler}>
  <List strong inset>
    {#each locales as [code, label]}
      <ListButton colors={{ bgIos: "active:bg-neutral-600/10" }} value={code} onclick={i18nClickHandler}>
        {label}
      </ListButton>
    {/each}
  </List>
</Popover>
