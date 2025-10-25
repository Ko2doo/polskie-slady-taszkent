<script>
  import { App, Page, Navbar, Block } from "konsta/svelte";
  import { i18nStores } from "@/services/i18n";

  // router
  import { Router } from "@mateothegreat/svelte5-router";
  import { routes } from "@/Routes";

  // Components
  import LangSwitcher from "@/components/Ui/LangSwitcher.svelte";
  import BottomToolbar from "@/components/Ui/BottomToolbar.svelte";

  // Store
  const { i18n, isError } = i18nStores;
</script>

<App theme="ios" safeAreas>
  <Page>
    <Router {routes} />

    <BottomToolbar />
    <!-- <Page>
    <Navbar title={$i18n.t("ui:app:name")} />

    {#if $isError}
      <Block strong>Failed to load translation</Block>
    {:else}
      <Block strong>{$i18n.t("ui:dialogue:hello")}</Block>
    {/if}

    <LangSwitcher />
  </Page> -->
  </Page>
</App>
