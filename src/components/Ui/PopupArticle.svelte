<script>
  /**
   * A component with a dynamic router based on the article ID that opens a new screen with an expanded popup.
   */
  import { Popup, Page, Navbar, Block, Link } from "konsta/svelte";

  import { goto } from "@mateothegreat/svelte5-router";

  import { i18nStores } from "@/services/i18n";
  const { i18n } = i18nStores;

  import { articlesMeta } from "@/data/articles";

  // let { params } = $props();
  let { route } = $props();
  // $inspect("PopupArticle props >>>", route.result);

  let params = route?.result?.path.params;
  const articleId = params;

  const meta = $derived(articlesMeta.find((a) => a.id === articleId));

  function closePopup() {
    goto("/handbook");
  }
</script>

{#if !articleId}
  <!-- Not id`s -->
  <Page>
    <Block class="mt-[100px] text-center text-2xl">
      <p class="text-red-600 text-bold">
        {$i18n.t("ui:errors:noArticleId")}
      </p>

      <Link onclick={closePopup} class="mt-[22px] text-primary underline">
        {$i18n.t("ui:buttons:back")}
      </Link>
    </Block>
  </Page>
{:else if !meta}
  <!-- article not found -->
  <Page>
    <Block class="mt-[100px] text-center text-2xl">
      <p class="text-red-600 text-bold">
        {$i18n.t("ui:errors:articleNotFound")} ({articleId}).
      </p>

      <Link onclick={closePopup} class="mt-[22px] text-primary underline">
        {$i18n.t("ui:buttons:back")}
      </Link>
    </Block>
  </Page>
{:else}
  <Popup opened class="safe-area-inset">
    <Page>
      <Navbar>
        {#snippet right()}
          <Link iconOnly onclick={closePopup}>
            <svg
              fill="currentcolor"
              xmlns="http://www.w3.org/2000/svg"
              width="1em"
              height="1em"
              viewBox="0 0 56 56"
              class="size-5"
              ><path
                d="M 10.0234 43.0234 C 9.2266 43.8203 9.2031 45.1797 10.0234 45.9766 C 10.8438 46.7734 12.1797 46.7734 13.0000 45.9766 L 28.0000 30.9766 L 43.0000 45.9766 C 43.7969 46.7734 45.1563 46.7969 45.9766 45.9766 C 46.7734 45.1562 46.7734 43.8203 45.9766 43.0234 L 30.9531 28.0000 L 45.9766 13.0000 C 46.7734 12.2031 46.7969 10.8437 45.9766 10.0469 C 45.1328 9.2266 43.7969 9.2266 43.0000 10.0469 L 28.0000 25.0469 L 13.0000 10.0469 C 12.1797 9.2266 10.8203 9.2031 10.0234 10.0469 C 9.2266 10.8672 9.2266 12.2031 10.0234 13.0000 L 25.0234 28.0000 Z"
              ></path></svg
            >
          </Link>
        {/snippet}
      </Navbar>

      <Block class="text-base leading-relaxed">
        <h1 class="mb-4 text-bold text-2xl text-neutral-800">{$i18n.t(`articles:${meta.id}:title`)}</h1>

        <p class="text-neutral-800">
          {@html $i18n.t(`articles:${meta.id}:description`)}
        </p>
      </Block>
    </Page>
  </Popup>
{/if}
