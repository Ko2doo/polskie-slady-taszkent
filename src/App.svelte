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

    <div class="w-20 h-20 bg-red-500 text-white p-4">Tailwind Test</div>

    {#if $isError}
      <Block strong>Failed to load translation</Block>
    {:else}
      <Block strong>{$i18n.t("ui:dialogue:hello")}</Block>
    {/if}

    <!-- Language changer -->
    <LangSwitcher />
  </Page>
</App>
