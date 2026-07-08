<script>
  import { Block, NavbarBackLink } from "konsta/svelte";
  import { fly } from "svelte/transition";

  import { resolvePageKeyFromRouteResult } from "@/utils/routerUtils";
  import { withNavbar } from "@/store/ui/navbar";
  import { withTabbar } from "@/store/ui/bottomTabbarNav";

  import { routerBack } from "@/services/navigationHistoryHook";

  let { route, i18n } = $props();

  const aboutItems = $i18n.t("about:fullInfo", { returnObjects: true });

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
    withTabbar({
      isVisible: false,
      duration: 120,
      delay: 40,
    });
  });

  function handleBack() {
    routerBack("/");
  }
</script>

{#snippet BackButton()}
  <NavbarBackLink text="Back" onClick={handleBack} />
{/snippet}

<section class="about-view flex flex-col" in:fly={{ duration: 120, x: 20 }}>
  <Block strong inset>
    <article class="flex flex-col pt-4 pb-4 gap-8">
      {#each aboutItems as item (item.id)}
        <div class="flex flex-col self-baseline gap-2 w-full">
          <b class="block text-[18px] text-stone-800 dark:text-stone-100">
            {item.title}
          </b>

          <p class="text-[16px] font-normal text-stone-700 dark:text-stone-200">
            {item.description}

            {#if item.email}
              <a class="text-blue-600 font-bold" href="mailto:{item.email}">
                {item.email}
              </a>
            {/if}
          </p>
        </div>
      {/each}
    </article>
  </Block>
</section>
