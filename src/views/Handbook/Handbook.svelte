<script>
  import { Card, Link, Button, BlockTitle } from "konsta/svelte";
  import { goto, normalize } from "@mateothegreat/svelte5-router";

  // Filters and searching
  import LayoutSwitcher from "@/components/Ui/Filters/LayoutSwitcher.svelte";
  import SortingByCategories from "@/components/Ui/Filters/SortingByCategories.svelte";
  import SearchBar from "@/components/Ui/SearchBar.svelte";

  // Icons
  import FilterIcon from "@/lib/icons/FilterIcon.svelte";
  import ShieldWarningIcon from "@/lib/icons/ShieldWarningIcon.svelte";

  // Navbar/Panel stores and helpers
  import { resolvePageKeyFromRouteResult } from "@/utils/routerUtils";
  import { patchNavbar, withNavbar } from "@/store/ui/navbar";
  import { withPanel, openPanel, patchPanel } from "@/store/ui/panel";

  // Content meta
  import { articlesMeta } from "@/data/articles";

  // Lifecycles
  import { onMount, onDestroy } from "svelte";

  // Layout global store
  import { layoutView } from "@/store/ui/layoutView";

  // Route prop (Svelte 5)
  let { route, i18n } = $props();

  // Page-local state
  let query = $state(""); // search query (for UI state only)
  let searchResults = $state(articlesMeta); // output from SearchBar
  let selectedCat = $state("all"); // category filter (single string)
  let itemsView = $state(articlesMeta); // final list: search + category

  // Layout state
  let layout = $state(null);

  // Receive search results from SearchBar
  function handleSearchResults(list) {
    searchResults = list;
  }

  // Receive selected category id from SortingByCategories
  function handleCatUpdate(id) {
    selectedCat = typeof id === "string" && id ? id : "all";
  }

  // Setup Navbar and Panel profiles once on mount; cleaned on destroy
  onMount(() => {
    const disposeNavbar = withNavbar({
      title: "",
      leftSnippet: PanelOpenedButton, // left slot: open side panel button
      rightSnippet: null, // right slot: (unused for now)c
      subnavSnippet: Subnavigation, // subnavbar: search bar
    });

    const disposePanel = withPanel({
      title: "",
      contentSnippet: PanelContent, // panel body content (filters)
      side: "left", // open from the left
    });

    onDestroy(() => {
      disposeNavbar();
      disposePanel();
    });
  });

  $effect(() => {
    return layoutView.subscribe((v) => (layout = v));
  });

  // Combine search and category filters into the final view list
  $effect(() => {
    const base = searchResults; // start with search output
    itemsView = selectedCat === "all" ? base : base.filter((it) => it?.category === selectedCat);
  });

  // Update page/side-panel titles when route or language change
  $effect(() => {
    const result = route?.result;
    // console.log(result);

    // get "pageKey" from route path
    //    "/about" -> "about"
    //    "/handbook" -> "handbook"
    const pageKey = resolvePageKeyFromRouteResult(result);

    /* prettier-ignore */
    const navTitle = pageKey
      ? $i18n.t(`ui:navbar:${pageKey}:title`)
      : "";
    const panelTitle = $i18n.t("ui:sidePanel:handbook:title");

    patchNavbar({ title: navTitle || pageKey });
    patchPanel({ title: panelTitle });
  });

  // Inspector check console in browser
  // $inspect(route);

  function openArticle(id) {
    goto(`/articles/${id}`);
  }
</script>

<!-- Snippets -->
{#snippet PanelOpenedButton()}
  <Link iconOnly onClick={() => openPanel()}>
    <FilterIcon />
  </Link>
{/snippet}

{#snippet Subnavigation()}
  <SearchBar
    {i18n}
    items={articlesMeta}
    nameSpace="articles"
    fields={["title", "description"]}
    onResults={handleSearchResults}
    onQueryChange={(v) => (query = v)}
  />
{/snippet}

{#snippet PanelContent()}
  <LayoutSwitcher {i18n} />
  <SortingByCategories {i18n} items={articlesMeta} onSelectedChange={handleCatUpdate} />
{/snippet}

{#if query.trim() && itemsView.length === 0}
  <section class="grid grid-1 justify-center">
    <BlockTitle large class="flex-col">
      <ShieldWarningIcon className="size-20 mb-2 text-red-500" />

      {$i18n.t("errors:notFound")}
    </BlockTitle>
  </section>
{:else}
  <section class={layout ? layout.classes : "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4"}>
    {#each itemsView as article (article.id)}
      <Card class="flex flex-col justify-between">
        {#snippet header()}
          <h1 class="w-full text-gray-900 dark:text-stone-300 text-base font-medium sm:font-bold sm:text-xl">
            {$i18n.t(`articles:${article.id}:title`)}
          </h1>
        {/snippet}

        <p class="line-clamp-3 text-sm sm:text-base">
          {@html $i18n.t(`articles:${article.id}:description`)}
        </p>

        {#snippet footer()}
          <div class="flex justify-between space-x-2 rtl:space-x-reverse">
            <Button small raised rounded inline class="text-sm" onClick={() => openArticle(article.id)}>
              {$i18n.t("ui:buttons:readMore")}
            </Button>
          </div>
        {/snippet}
      </Card>
    {/each}
  </section>
{/if}
