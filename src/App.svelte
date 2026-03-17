<script>
  import { App, Page, Navbar, Panel, Link, Block } from "konsta/svelte";

  // Svelte
  import { onMount, setContext } from "svelte";

  // Custom splash screen
  import AppSplash from "@/AppSplash.svelte";

  // Capacitor
  import { initBackButtonHandler } from "@/capacitor/backButton";

  // i18Next
  import { i18nStores } from "@/capacitor/services/i18n";
  const { i18n } = i18nStores;

  // router
  import { Router } from "@mateothegreat/svelte5-router";
  import { routes } from "@/Routes";
  // from route-friendly back button logic hook
  import { navigationHistoryPostHook } from "@/services/navigationHistoryHook";

  // Components
  import BottomTabbarNav from "@/components/BottomTabbarNav.svelte";
  import ErrorHandlerToast from "@/components/ErrorHandlerToast.svelte";
  import ExitToast from "@/components/ExitToast.svelte";
  import OnboardingWizard from "@/components/OnboardingWizard.svelte";

  // Icons
  import Close from "@/lib/icons/Close.svelte";

  // Store imports
  import { navbarState } from "@/store/ui/navbar";
  import { panelState, openPanel, closePanel } from "@/store/ui/panel";
  import { initFirstLaunch, APP_FIRST_LAUNCH_STORAGE_VAL, markFirstLaunchCompleted } from "@/store/appStartInitialize";
  import { bottomTabbarState, resetTabbar } from "@/store/ui/bottomTabbarNav";

  // App ready state
  let APP_READY = $state(false);
  let { appName = "", version = "" } = $props();

  function createScrollState() {
    let y = $state(0);

    return {
      get y() {
        return y;
      },
      set y(val) {
        y = val;
      },
    };
  }

  const scrollState = createScrollState();
  setContext("appScroll", scrollState);

  function handleScroll(e) {
    scrollState.y = e.currentTarget.scrollTop;
  }

  $effect(() => {
    if (APP_READY) resetTabbar();
  });

  // On mount svelte initialization
  onMount(async () => {
    await initFirstLaunch(); // waiting Capacitor Preferences
    initBackButtonHandler();
    APP_READY = true;
  });
</script>

{#if !APP_READY}
  <AppSplash {appName} {version} />
{:else}
  <App theme="ios" safeAreas>
    <Page class="flex flex-col">
      <div class="app-wrapper" onscroll={handleScroll}>
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
          <Navbar title={$navbarState.title ?? ""} class="pb-2 rounded-b-2xl">
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
        <main class="flex-1 pb-safe-24">
          <Router
            {routes}
            hooks={{
              post: navigationHistoryPostHook,
            }}
            {i18n}
            {appName}
            {version}
          />
        </main>

        <!-- Panel -->
        <Panel
          side={$panelState.side}
          floating={$panelState.floating}
          backdrop={$panelState.backdrop}
          opened={$panelState.isOpen}
          onBackdropClick={() => closePanel()}
          class="overflow-y-auto"
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

        <!-- prettier-ignore -->
        <OnboardingWizard
          {i18n}
          appState={APP_FIRST_LAUNCH_STORAGE_VAL}
          makeCompleted={markFirstLaunchCompleted}
        />

        <ExitToast {i18n} />

        <!-- Error toast init -->
        <ErrorHandlerToast {i18n} />

        {#if $bottomTabbarState.isVisible}
          <!-- Fixed bottom navigation -->
          <BottomTabbarNav {i18n} duration={$bottomTabbarState.duration} delay={$bottomTabbarState.delay} />
        {/if}
      </div>
    </Page>
  </App>
{/if}

<style>
  .app-wrapper {
    display: flex;
    flex-direction: column;

    min-height: 100dvh;

    overflow-y: auto;
  }
</style>
