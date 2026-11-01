<script>
  import { Block, BlockTitle, NavbarBackLink, Button } from "konsta/svelte";
  import { fly } from "svelte/transition";

  // Components
  import TranslateIcon from "@/lib/icons/TranslateIcon.svelte";
  import PaletteIcon from "@/lib/icons/PaletteIcon.svelte";
  import LockIcon from "@/lib/icons/LockIcon.svelte";

  import { resolvePageKeyFromRouteResult } from "@/utils/routerUtils";
  import { withNavbar } from "@/lib/state/navbar.svelte";
  import { hideTabbar, QUICK_TABBAR_SLIDE } from "@/lib/state/bottomTabbarNav.svelte";

  import { openAppSettings } from "@/capacitor/services/locationPermission";

  import { routerBack } from "@/services/navigationHistoryHook";

  import DarkModeToggler from "@/components/Preferences/DarkModeToggler.svelte";
  import LangSwitcher from "@/components/Preferences/LangSwitcher.svelte";
  import CustomPointsTransfer from "@/components/CustomPoints/CustomPointsTransfer.svelte";

  // router props
  let { route, i18n } = $props();

  $effect(() => {
    const result = route?.result;

    // get "pageKey" from route path
    //    "/about" -> "about"
    //    "/handbook" -> "handbook"
    const pageKey = resolvePageKeyFromRouteResult(result);

    /* prettier-ignore */
    const title = pageKey
      ? $i18n.t(`ui:navbar:${pageKey}:title`)
      : "";

    const dispose = withNavbar({
      title: title || pageKey,
      leftSnippet: BackButton,
    });

    return dispose;
  });

  // No tab bar on this screen; the request is released when the screen goes away
  $effect(() => hideTabbar(QUICK_TABBAR_SLIDE));

  function handleBack() {
    routerBack("/more");
  }
</script>

{#snippet BackButton()}
  <NavbarBackLink onClick={handleBack} aria-label={$i18n.t("ui:buttons:back")} />
{/snippet}

<section class="settings-view flex flex-col" in:fly={{ duration: 120, x: 20 }}>
  <Block strong inset>
    <!-- Language section -->
    <BlockTitle medium class="justify-baseline">
      <TranslateIcon className="size-8" strokeColor="currentColor" />

      <span class="ml-4">
        {$i18n.t("ui:settings:translations:title")}
      </span>

      <div class="ml-auto">
        <LangSwitcher {i18n} raised={true} rounded={true} small={true} />
      </div>
    </BlockTitle>

    <!-- Language Hint -->
    <div class="mt-4 px-4 pb-4">
      <p class="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
        {$i18n.t("ui:settings:translations:hint")}
      </p>
    </div>

    <!-- Divider -->
    <div class="border-t border-gray-400 dark:border-gray-700 my-2"></div>

    <!-- Appearance Section -->
    <BlockTitle medium class="justify-baseline">
      <PaletteIcon className="size-8" strokeColor="currentColor" />

      <span class="ml-4">
        {$i18n.t("ui:settings:appearance:title")}
      </span>
    </BlockTitle>

    <!-- Appearance Hint -->
    <div class="mt-4 px-4 pt-2">
      <p class="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
        {$i18n.t("ui:settings:appearance:hint")}
      </p>
    </div>

    <DarkModeToggler {i18n} inset={true} />

    <!-- Divider -->
    <div class="border-t border-gray-400 dark:border-gray-700 my-2"></div>

    <!-- Custom points export/import section -->
    <CustomPointsTransfer {i18n} />

    <!-- Divider -->
    <div class="border-t border-gray-400 dark:border-gray-700 my-2"></div>

    <!-- Permission section: always the last one -->
    <BlockTitle medium class="justify-baseline">
      <LockIcon className="size-8" strokeColor="currentColor" />

      <span class="ml-4">
        {$i18n.t("ui:settings:permissions:title")}
      </span>
    </BlockTitle>

    <!-- Permission Hint -->
    <div class="mt-4 px-4 pb-4">
      <p class="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
        {$i18n.t("ui:settings:permissions:hint")}
      </p>
    </div>

    <Button raised rounded small onClick={() => openAppSettings()}>
      {$i18n.t("ui:buttons:openSettings")}
    </Button>
  </Block>
</section>
