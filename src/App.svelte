<script>
  import { App, Page, Navbar, Panel, Link, Block } from "konsta/svelte";

  // i18Next
  import { i18nStores } from "@/services/i18n";
  const { i18n } = i18nStores;

  // router
  import { Router } from "@mateothegreat/svelte5-router";
  import { routes } from "@/Routes";

  // Components
  import BottomTabbarNav from "@/components/Ui/BottomTabbarNav.svelte";

  // Store imports
  import { navbarState } from "@/store/ui/navbar";
  import { panelState, openPanel, closePanel } from "@/store/ui/panel";
</script>

<App theme="ios" safeAreas>
  <Page class="flex flex-col min-h-[100dvh] !p-0">
    {#if $navbarState.subnavSnippet}
      <Navbar title={$navbarState.title ?? ""}>
        <!-- Left content -->
        {#snippet left()}
          {#if $navbarState.leftSnippet}
            {@render $navbarState.leftSnippet()}
          {/if}
        {/snippet}

        <!-- Right content -->
        {#snippet right()}
          {#if $navbarState.rightSnippet}
            {@render $navbarState.rightSnippet()}
          {/if}
        {/snippet}

        <!-- Subnav -->
        {#snippet subnavbar()}
          {@render $navbarState.subnavSnippet()}
        {/snippet}
      </Navbar>
    {:else}
      <Navbar title={$navbarState.title ?? ""}>
        <!-- Left content -->
        {#snippet left()}
          {#if $navbarState.leftSnippet}
            {@render $navbarState.leftSnippet()}
          {/if}
        {/snippet}

        <!-- Right content -->
        {#snippet right()}
          {#if $navbarState.rightSnippet}
            {@render $navbarState.rightSnippet()}
          {/if}
        {/snippet}
      </Navbar>
    {/if}

    <!-- Centered content -->
    <main class="flex-1 overflow-y-auto pb-[56px]">
      <Router {routes} {i18n} />
    </main>

    <!-- Panel -->
    <Panel
      side={$panelState.side}
      floating={$panelState.floating}
      backdrop={$panelState.backdrop}
      opened={$panelState.isOpen}
      onBackdropClick={() => closePanel()}
    >
      <Navbar title={$panelState.title}>
        {#snippet right()}
          <Link iconOnly onClick={() => closePanel()}>
            <svg
              fill="currentcolor"
              xmlns="http://www.w3.org/2000/svg"
              width="1em"
              height="1em"
              viewBox="0 0 56 56"
              class="size-5"
              ><path
                d="M 10.0234 43.0234 C 9.2266 43.8203 9.2031 45.1797 10.0234 45.9766 C 10.8438 46.7734 12.1797 46.7734 13.0000 45.9766 L 28.0000 30.9766 L 43.0000 45.9766 C 43.7969 46.7734 45.1563 46.7969 45.9766 45.9766 C 46.7734 45.1562 46.7734 43.8203 45.9766 43.0234 L 30.9531 28.0000 L 45.9766 13.0000 C 46.7734 12.2031 46.7969 10.8437 45.9766 10.0469 C 45.1328 9.2266 43.7969 9.2266 43.0000 10.0469 L 28.0000 25.0469 L 13.0000 10.0469 C 12.1797 9.2266 10.8203 9.2031 10.0234 10.0469 C 9.2266 10.8672 9.2266 12.2031 10.0234 13.0000 L 25.0234 28.0000 Z"
              ></path></svg
            >
          </Link>
        {/snippet}
      </Navbar>

      <!-- Dynamical content -->
      {#if $panelState.contentSnippet}
        {@render $panelState.contentSnippet()}
      {/if}
    </Panel>

    <!-- Fixed bottom navigation -->
    <BottomTabbarNav {i18n} />
  </Page>
</App>
