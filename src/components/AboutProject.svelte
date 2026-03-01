<script>
  import { Block, NavbarBackLink } from "konsta/svelte";
  import { fly } from "svelte/transition";

  import { resolvePageKeyFromRouteResult } from "@/utils/routerUtils";
  import { withNavbar } from "@/store/ui/navbar";
  import { setTabbar } from "@/store/ui/bottomTabbarNav";

  // Icons
  import Close from "@/lib/icons/Close.svelte";
  import SPLogo from "@/lib/icons/SPLogo.svelte";

  import { routerBack } from "@/services/navigationHistoryHook";

  let { route, i18n } = $props();

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
      leftSnippet: BackButton,
    });

    return dispose;
  });

  $effect(() => {
    setTabbar({
      isVisible: false,
    });
  });

  function handleBack() {
    routerBack("/");
  }
</script>

{#snippet BackButton()}
  <NavbarBackLink text="Back" onClick={handleBack} />
{/snippet}

<section class="about-view relative z-60 flex flex-col" in:fly={{ duration: 120, x: 20 }}>
  <Block strong inset>
    <figure class="logo-wrapper flex flex-col items-center">
      <SPLogo />

      <figcaption class="mt-4">
        {@html $i18n.t("ui:more:about:info")}
      </figcaption>
    </figure>
  </Block>
</section>
