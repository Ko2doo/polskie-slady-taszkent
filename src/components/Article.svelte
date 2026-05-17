<script>
  /**
   * A component with a dynamic router based on the article ID that opens a new screen.
   */
  import { Popup, Page, Navbar, NavbarBackLink, Block, Link, Button } from "konsta/svelte";

  import { routerBack } from "@/services/navigationHistoryHook";

  import { articlesMeta } from "@/data/articles";
  import { articlePopupState } from "@/lib/state/article.svelte";

  // Router
  import { goto } from "@mateothegreat/svelte5-router";

  import ArrowRightIcon from "@/lib/icons/ArrowRightIcon.svelte";

  let { i18n } = $props();

  // svelte-ignore state_referenced_locally
  // check this: https://github.com/sveltejs/svelte/issues/12877
  // let articleId = route?.result?.path.params;
  // const meta = articlesMeta.find((a) => a.id === articleId);

  const meta = $derived(articlePopupState.id ? articlesMeta.find((a) => a.id === articlePopupState.id) : null);

  function getToMap(coords) {
    const [lat, lon] = coords;
    const search = new URLSearchParams({
      lon: String(lon),
      lat: String(lat),
    });

    goto(`/?${search.toString()}`);
  }

  function handleBack() {
    routerBack("/");
  }
</script>

<Popup opened={articlePopupState.isOpen}>
  <Page>
    <Navbar>
      {#snippet left()}
        <NavbarBackLink text="Back" onClick={articlePopupState.close} />
      {/snippet}
    </Navbar>

    {#if meta}
      <Block class="pb-safe-4 text-base leading-relaxed">
        <h1 class="mb-4 text-bold text-2xl text-neutral-800 dark:text-neutral-300">
          {$i18n.t(`articles:${meta.id}:title`)}
        </h1>

        <p class="text-neutral-800 dark:text-neutral-300">
          {@html $i18n.t(`articles:${meta.id}:description`)}
        </p>

        <Button
          small
          raised
          rounded
          class="k-color-brand-blue mt-4 ml-auto w-auto justify-between text-md"
          onClick={() => {
            articlePopupState.close();
            getToMap(meta.coords);
          }}
        >
          <span> {$i18n.t("ui:buttons:toMaps")} </span>

          <ArrowRightIcon className="size-5" />
        </Button>
      </Block>
    {/if}
  </Page>
</Popup>
