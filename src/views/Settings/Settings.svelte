<script>
  import { Block, BlockTitle, MenuList, MenuListItem } from "konsta/svelte";
  // Components
  import LangSwitcher from "@/components/Ui/LangSwitcher.svelte";
  import TranslateIcon from "@/lib/icons/TranslateIcon.svelte";
  import PaletteIcon from "@/lib/icons/PaletteIcon.svelte";

  import { resolvePageKeyFromRouteResult } from "@/utils/routerUtils";
  import { withNavbar } from "@/store/ui/navbar";
  import DarkModeToggler from "@/components/Ui/DarkModeToggler.svelte";

  // router props
  let { route, i18n } = $props();

  // Inspector check console in browser
  // $inspect(route);

  $effect(() => {
    const result = route?.result;
    // console.log(result);

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
      showSidePanel: false,
      showFavorites: false,
    });

    return dispose;
  });
</script>

<section class="flex flex-col">
  <Block strong inset>
    <!-- Language section -->
    <BlockTitle large class="text-stone-500 justify-baseline">
      <TranslateIcon className="w-10 h-10" strokeColor="currentColor" />

      <span class="ml-4">
        {$i18n.t("ui:settings:translations:title")}
      </span>

      <div class="ml-auto">
        <LangSwitcher {i18n} />
      </div>
    </BlockTitle>

    <!-- Language Hint -->
    <div class="mt-4 px-4 pb-4">
      <p class="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
        {$i18n.t("ui:settings:translations:hint")}
      </p>
    </div>

    <!-- Divider -->
    <div class="border-t border-gray-200 dark:border-gray-700 my-2"></div>

    <!-- Appearance Section -->
    <BlockTitle large class="text-stone-500 justify-baseline">
      <PaletteIcon className="w-10 h-10" strokeColor="currentColor" />

      <span class="ml-4">
        {$i18n.t("ui:settings:appearance:title")}
      </span>
    </BlockTitle>

    <!-- Appearance Hint (optional) -->
    <div class="mt-4 px-4 pt-2">
      <p class="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
        {$i18n.t("ui:settings:appearance:hint")}
      </p>
    </div>

    <DarkModeToggler {i18n} />
  </Block>
</section>
