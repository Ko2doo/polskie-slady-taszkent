<script>
  import { Card, Button } from "konsta/svelte";
  import { goto } from "@mateothegreat/svelte5-router";

  import LayoutSwitcher from "@/components/Ui/Filters/LayoutSwitcher.svelte";

  // i18Next
  import { i18nStores } from "@/services/i18n";
  const { i18n } = i18nStores;

  // Utils and store
  import { resolvePageKeyFromRouteResult } from "@/utils/routerUtils";
  import { withNavbar } from "@/store/ui/navbar";
  import { withPanel, openPanel, patchPanel } from "@/store/ui/panel";

  // Cards meta
  import { articlesMeta } from "@/data/articles";

  // router props
  let { route } = $props();

  // Get route props, and render navbar title with i18n
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

    // Tell the global navbar:
    // - which title to show
    // - whether to show search
    // - whether to show favrites
    const disposeNavbar = withNavbar({
      title: title || pageKey,
      showSidePanel: true,
      showFavorites: false,
    });

    const disposePanel = withPanel({
      title: $i18n.t("ui:sidePanel:handbook:title"),
      content: {
        component: LayoutSwitcher,
        props: {
          onChange: handleLayoutChange,
        },
      },
    });

    return () => {
      disposeNavbar();
      disposePanel();
    };
  });

  // Inspector check console in browser
  // $inspect(route);

  let currentLayoutClasses = $state("grid grid-cols-2 lg:grid-cols-4 md:grid-cols-3");

  function handleLayoutChange(payload) {
    // payload = { mode: "layoutGrid" | "layoutRows", classes: "..." }
    currentLayoutClasses = payload.classes;
  }

  function openArticle(id) {
    goto(`/articles/${id}`);
  }
</script>

<header class="flex flex-nowrap gap-4 p-4">
  <!-- Serching -->
</header>

<section class={currentLayoutClasses}>
  {#each articlesMeta as article (article.id)}
    <Card class="flex flex-col justify-between">
      {#snippet header()}
        <h1 class="w-full text-gray-900 dark:text-gray-900 text-base font-medium sm:font-bold sm:text-xl">
          {$i18n.t(`articles:${article.id}:title`)}
        </h1>
      {/snippet}

      <p class="line-clamp-3 text-sm sm:text-base">
        {@html $i18n.t(`articles:${article.id}:description`)}
      </p>

      {#snippet footer()}
        <div class="flex justify-between space-x-2 rtl:space-x-reverse">
          <Button rounded inline outline class="text-sm" onClick={() => openArticle(article.id)}>
            {$i18n.t("ui:buttons:readMore")}
          </Button>
        </div>
      {/snippet}
    </Card>
  {/each}
</section>
