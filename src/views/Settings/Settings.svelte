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
    <BlockTitle large class="text-stone-500 justify-baseline">
      <TranslateIcon className="w-10 h-10" strokeColor="currentColor" />

      <span class="ml-4">
        {$i18n.t("ui:settings:translations:title")}
      </span>

      <div class="ml-auto">
        <LangSwitcher {i18n} />
      </div>
    </BlockTitle>

    <BlockTitle large class="text-stone-500 justify-baseline">
      <PaletteIcon className="w-10 h-10" strokeColor="currentColor" />

      <span class="ml-4">
        {$i18n.t("ui:settings:appearance:title")}
      </span>
    </BlockTitle>
    <DarkModeToggler {i18n} />
  </Block>
</section>
