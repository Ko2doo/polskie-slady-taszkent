<script>
  import { App, Page, Navbar, Block } from "konsta/svelte";
  import { i18nStores } from "@/services/i18n";

  // router
  import { Router, route } from "@mateothegreat/svelte5-router";
  import { routes } from "./Routes";

  // Components
  import LangSwitcher from "@/components/Ui/LangSwitcher.svelte";

  // Store
  const { i18n, isError } = i18nStores;

  // Router link params
  const routeParam = {
    default: { class: ["text-gray-600"] },
    active: {
      class: ["text-blue-600", "font-bold"],
      absolute: true,
    },
  };
</script>

<App theme="ios" safeAreas>
  <Router {routes} />

  <nav>
    <a href="/" use:route={routeParam}>Home</a>
    <a href="/handbook" use:route={routeParam}>Handbook</a>
    <a href="/about" use:route={routeParam}>About</a>
  </nav>

  <!-- <Page>
    <Navbar title={$i18n.t("ui:app:name")} />

    {#if $isError}
      <Block strong>Failed to load translation</Block>
    {:else}
      <Block strong>{$i18n.t("ui:dialogue:hello")}</Block>
    {/if}

    <LangSwitcher />
  </Page> -->
</App>
