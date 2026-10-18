<script>
  /**
   * Language switcher: a button with the current language's own name that opens a popover listing
   * every language (`locales/collections.js`); picking one switches i18next and closes it.
   * Any other props go to the Konsta `Button`.
   */

  import { Popover, List, ListButton, Button } from "konsta/svelte";

  import { translations } from "@/locales/collections";

  let { i18n, ...btnSettings } = $props();

  // The popover is anchored to the trigger button by this class
  const TRIGGER_SELECTOR = ".popover-trigger";

  const locales = Object.entries(translations);

  let popoverOpened = $state(false);
  let popoverTarget = $state(null);

  // An unknown language code shows an empty button rather than a wrong name
  const currentLanguageName = $derived(translations[$i18n.language] ?? "");

  function openPopover() {
    popoverTarget = TRIGGER_SELECTOR;
    popoverOpened = true;
  }

  function closePopover() {
    popoverOpened = false;
  }

  function selectLanguage(code) {
    $i18n.changeLanguage(code);
    closePopover();
  }
</script>

<Button {...btnSettings} class="popover-trigger" onClick={openPopover}>
  {currentLanguageName}
</Button>

<Popover opened={popoverOpened} target={popoverTarget} backdrop={true} onBackdropClick={closePopover}>
  <List nested>
    {#each locales as [code, label] (code)}
      <ListButton
        colors={{ bgIos: "active:bg-neutral-600/10", textIos: "text-stone-500 dark:text-stone-200" }}
        value={code}
        onClick={() => selectLanguage(code)}
      >
        {label}
      </ListButton>
    {/each}
  </List>
</Popover>
