<script>
  import { App, Page, Navbar, Panel, Link, Block } from "konsta/svelte";

  // Svelte
  import { onMount } from "svelte";

  // Capacitor
  import { initBackButtonHandler } from "@/capacitor/backButton";
  import ExitToast from "@/components/Ui/ExitToast.svelte";

  // i18Next
  import { i18nStores } from "@/capacitor/services/i18n";
  const { i18n } = i18nStores;

  // router
  import { Router } from "@mateothegreat/svelte5-router";
  import { routes } from "@/Routes";
  // from route-friendly back button logic hook
  import { navigationHistoryPostHook } from "@/services/navigationHistoryHook";

  // Components
  import BottomTabbarNav from "@/components/Ui/BottomTabbarNav.svelte";

  // Store imports
  import { navbarState } from "@/store/ui/navbar";
  import { panelState, openPanel, closePanel } from "@/store/ui/panel";

  import { getThemeManager } from "@/lib/theme/themeManager";
  import ErrorHandlerToast from "./components/Ui/ErrorHandlerToast.svelte";

  import Close from "./lib/icons/Close.svelte";

  onMount(() => {
    initBackButtonHandler();

    // Initialize theme as soon app mounts
    getThemeManager().init();
  });
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
    <main class="flex-1 overflow-y-auto">
      <Router
        {routes}
        hooks={{
          post: navigationHistoryPostHook,
        }}
        {i18n}
      />
      <ExitToast {i18n} />
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
            <Close />
          </Link>
        {/snippet}
      </Navbar>

      <!-- Dynamical content -->
      {#if $panelState.contentSnippet}
        {@render $panelState.contentSnippet()}
      {/if}
    </Panel>

    <!-- Error toast init -->
    <ErrorHandlerToast {i18n} />

    <!-- Fixed bottom navigation -->
    <BottomTabbarNav {i18n} />
  </Page>
</App>
