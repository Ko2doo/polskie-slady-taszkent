<script>
  import { Card, Button } from "konsta/svelte";
  import { goto } from "@mateothegreat/svelte5-router";

  import { i18nStores } from "@/services/i18n";
  const { i18n } = i18nStores;

  import { resolvePageKeyFromRouteResult } from "@/utils/routerUtils";
  import { setNavbar } from "@/store/ui/navbar";

  // Cards meta
  import { articlesMeta } from "@/data/articles";

  // router props
  let { route } = $props();

  // Inspector check console in browser
  // $inspect(route);

  $effect(() => {
    const result = route?.result;

    // get "pageKey" from route path
    //    "/"      -> "home"
    //    "/about" -> "about"
    //    "/handbook" -> "handbook"
    const pageKey = resolvePageKeyFromRouteResult(result);

    /* prettier-ignore */
    const translatedTitle = pageKey
      ? $i18n.t(`ui:navbar:${pageKey}:title`)
      : "";

    // Tell the global navbar:
    // - which title to show
    // - whether to show search
    // - whether to show favrites
    setNavbar({
      title: translatedTitle || pageKey,
    });
  });

  function openArticle(id) {
    goto(`/articles/${id}`);
  }
</script>

<section class="grid grid-cols-1 md:grid-cols-3 sm:grid-cols-2">
  {#each articlesMeta as article (article.id)}
    <Card>
      {#snippet header()}
        <div
          class="ios:-mx-4 ios:-mt-4 h-48 flex items-end bg-cover bg-center material:rounded-xl"
          style="background-image: url(https://cdn.framework7.io/placeholder/people-1000x600-6.jpg)"
        >
          <h1 class="pl-4 pr-4 pt-1 pb-1 w-full text-gray-100 ios:font-bold material:text-[22px] backdrop-blur-xs">
            {$i18n.t(`articles:${article.id}:title`)}
          </h1>
        </div>
      {/snippet}

      <p class="line-clamp-3">
        {@html $i18n.t(`articles:${article.id}:description`)}
      </p>

      {#snippet footer()}
        <div class="flex justify-start space-x-2 rtl:space-x-reverse">
          <Button rounded inline outline onclick={() => openArticle(article.id)}>
            {$i18n.t("ui:buttons:readMore")}
          </Button>
        </div>
      {/snippet}
    </Card>
  {/each}
</section>
