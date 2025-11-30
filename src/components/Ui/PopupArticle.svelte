<script>
  /**
   * A component with a dynamic router based on the article ID that opens a new screen with an expanded popup.
   */
  import { Popup, Page, Navbar, NavbarBackLink, Block, Link } from "konsta/svelte";
  import { routerBack } from "@/services/navigationHistoryHook";

  import { articlesMeta } from "@/data/articles";

  let { route, i18n } = $props();
  // $inspect("PopupArticle props >>>", route.result);

  let articleId = route?.result?.path.params;
  const meta = $derived(articlesMeta.find((a) => a.id === articleId));

  function handleBack() {
    routerBack("/");
  }
</script>

{#if !articleId}
  <!-- Not id`s -->
  <Page>
    <Block class="mt-[100px] text-center text-2xl">
      <p class="text-red-600 text-bold">
        {$i18n.t("ui:errors:noArticleId")}
      </p>

      <Link onClick={handleBack} class="mt-[22px] text-primary underline">
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

      <Link onClick={handleBack} class="mt-[22px] text-primary underline">
        {$i18n.t("ui:buttons:back")}
      </Link>
    </Block>
  </Page>
{:else}
  <Popup opened class="safe-area-inset">
    <Page>
      <Navbar>
        {#snippet left()}
          <NavbarBackLink text="Back" onClick={handleBack} />
        {/snippet}
      </Navbar>

      <Block class="text-base leading-relaxed">
        <h1 class="mb-4 text-bold text-2xl text-neutral-800">
          {$i18n.t(`articles:${meta.id}:title`)}
        </h1>

        <p class="text-neutral-800">
          {@html $i18n.t(`articles:${meta.id}:description`)}
        </p>
      </Block>
    </Page>
  </Popup>
{/if}
