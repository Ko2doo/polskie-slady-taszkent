<script>
  import { App, Page, Navbar, Block } from "konsta/svelte";
  import { i18nStores } from "./services/i18n";

  // Components
  import LangSwitcher from "./components/Ui/LangSwitcher.svelte";

  // Store
  const { i18n, isError } = i18nStores;
</script>

<App theme="ios">
  <Page>
    <Navbar title={$i18n.t("ui:app:name")} />

    {#if $isError}
      <Block strong>Failed to load translation</Block>
    {:else}
      <Block strong>{$i18n.t("ui:dialogue:hello")}</Block>
    {/if}

    <!-- Language changer -->
    <LangSwitcher />
  </Page>
</App>
