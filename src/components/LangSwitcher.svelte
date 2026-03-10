<script>
  /**
   * Language switcher component
   */

  import { Popover, List, ListButton, Button } from "konsta/svelte";

  import { translations } from "@/locales/collections";

  let { i18n, ...btnSettings } = $props();

  let popoverState = $state(false);
  let popoverTargetEl = $state(null);
  let currentLocale = $state([]);

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

  $effect(() => {
    locales.filter(([code, label]) => {
      if (code === $i18n.language) {
        // console.log(label);
        currentLocale = label;
      }
    });
  });
</script>

<Button {...btnSettings} class="popover-trigger" onClick={() => popoverClickHandler(".popover-trigger")}>
  {currentLocale}
</Button>

<Popover opened={popoverState} target={popoverTargetEl} backdrop={true} onBackdropClick={backdropClickHandler}>
  <List nested>
    {#each locales as [code, label]}
      <ListButton
        colors={{ bgIos: "active:bg-neutral-600/10", textIos: "text-stone-500 dark:text-stone-200" }}
        value={code}
        onClick={i18nClickHandler}
      >
        {label}
      </ListButton>
    {/each}
  </List>
</Popover>
