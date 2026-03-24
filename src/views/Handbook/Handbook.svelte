<script>
  import { Card, Link, Button, BlockTitle } from "konsta/svelte";

  // Filters and searching
  import LayoutSwitcher from "@/components/Filters/LayoutSwitcher.svelte";
  import SortingByCategories from "@/components/Filters/SortingByCategories.svelte";
  import SearchBar from "@/components/SearchBar.svelte";

  // Icons
  import FilterIcon from "@/lib/icons/FilterIcon.svelte";
  import ShieldWarningIcon from "@/lib/icons/ShieldWarningIcon.svelte";
  import SearchIcon from "@/lib/icons/SearchIcon.svelte";

  // Navbar/Panel stores and helpers
  import { resolvePageKeyFromRouteResult } from "@/utils/routerUtils";
  import { patchNavbar, withNavbar } from "@/store/ui/navbar";
  import { withPanel, openPanel, patchPanel } from "@/store/ui/panel";

  // Content meta
  import { articlesMeta } from "@/data/articles";

  import { articlePopupState } from "@/lib/state/article.svelte";

  // Lifecycles
  import { onMount, onDestroy, getContext } from "svelte";

  // Transition
  import { fade, fly } from "svelte/transition";

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

  // Scroll State
  const scrollState = getContext("appScroll");

  let lastY = 0;
  let isSearchBarVisible = $state(true);
  let isSearchBarActive = $state(false);
  let hasScrolledPast = $state(false);

  // Receive search results from SearchBar
  function handleSearchResults(list) {
    searchResults = list;
  }

  // Receive selected category id from SortingByCategories
  function handleCatUpdate(id) {
    selectedCat = typeof id === "string" && id ? id : "all";
  }

  function openSearch() {
    isSearchBarActive = true;
    isSearchBarVisible = true;
  }

  function closeSearch() {
    isSearchBarActive = false;
    if (hasScrolledPast) isSearchBarVisible = false;
  }

  // Setup Navbar and Panel profiles once on mount; cleaned on destroy
  onMount(() => {
    const disposeNavbar = withNavbar({
      title: "",
      leftSnippet: PanelOpenedButton, // left slot: open side panel button
      // rightSnippet: null, // right slot: (unused for now)
      // subnavSnippet: null, // subnavbar: search bar
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
    const currentY = scrollState.y;

    if (!isSearchBarActive) {
      if (currentY > lastY && currentY > 80) {
        isSearchBarVisible = false;
        hasScrolledPast = true;
      } else if (currentY < lastY && currentY === 0) {
        isSearchBarVisible = true;
        hasScrolledPast = false;
      }
    }

    lastY = currentY;
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

    const navTitle = pageKey ? $i18n.t(`ui:navbar:${pageKey}:title`) : "";
    const panelTitle = $i18n.t("ui:sidePanel:handbook:title");

    patchNavbar({
      title: navTitle || pageKey,
      subnavSnippet: isSearchBarVisible ? Subnavigation : null,
      rightSnippet: hasScrolledPast ? SearchBarOpenedButton : null,
    });
    patchPanel({ title: panelTitle });
  });
</script>

<!-- Snippets -->
{#snippet PanelOpenedButton()}
  <Link iconOnly onClick={() => openPanel()}>
    <FilterIcon />
  </Link>
{/snippet}

{#snippet SearchBarOpenedButton()}
  {#if !isSearchBarActive}
    <Link iconOnly onClick={openSearch}>
      <SearchIcon />
    </Link>
  {/if}
{/snippet}

{#snippet Subnavigation()}
  <SearchBar
    {i18n}
    items={articlesMeta}
    nameSpace="articles"
    fields={["title", "description"]}
    shouldFocus={isSearchBarActive}
    onHideBar={closeSearch}
    onResults={handleSearchResults}
    onQueryChange={(v) => (query = v)}
  />
{/snippet}

{#snippet PanelContent()}
  <LayoutSwitcher {i18n} />
  <SortingByCategories {i18n} items={articlesMeta} onSelectedChange={handleCatUpdate} />
{/snippet}

<section class="pb-safe-24" in:fly={{ duration: 120, y: -20 }}>
  {#if query.trim() && itemsView.length === 0}
    <section class="grid grid-1 justify-center" in:fade={{ duration: 120 }}>
      <BlockTitle large class="flex-col">
        <ShieldWarningIcon className="size-20 mb-2 text-red-500" />

        {$i18n.t("errors:notFound")}
      </BlockTitle>
    </section>
  {:else}
    <section
      class={layout ? layout.classes : "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4"}
      in:fade={{ duration: 120 }}
    >
      {#each itemsView as article (article.id)}
        <Card class="flex flex-col justify-between" onclick={() => articlePopupState.open(article.id)}>
          {#snippet header()}
            <h1 class="w-full text-stone-800 dark:text-stone-100 text-base font-medium sm:font-bold sm:text-xl">
              {$i18n.t(`articles:${article.id}:title`)}
            </h1>
          {/snippet}

          {#if layout?.mode === "layoutRows"}
            <p class="text-gray-900 dark:text-stone-200 mb-4 line-clamp-3 text-sm sm:text-base">
              {@html $i18n.t(`articles:${article.id}:description`)}
            </p>
          {/if}

          <div class="flex justify-between space-x-2 rtl:space-x-reverse">
            <Button
              small
              raised
              rounded
              inline
              class="k-color-brand-blue text-sm"
              onClick={() => articlePopupState.open(article.id)}
            >
              {$i18n.t("ui:buttons:readMore")}
            </Button>
          </div>
        </Card>
      {/each}
    </section>
  {/if}
</section>
