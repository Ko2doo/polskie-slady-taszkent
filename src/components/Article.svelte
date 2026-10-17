<script>
  /**
   * A component with a dynamic router based on the article ID that opens a new screen.
   */
  import { Popup, Page, Navbar, NavbarBackLink, Block, Button } from "konsta/svelte";


  import { articlesMeta } from "@/data/articles";
  import { articlePopupState } from "@/lib/state/article.svelte";
  import { customPointsState } from "@/lib/state/customPointsState.svelte";

  // Router
  import { goto } from "@mateothegreat/svelte5-router";

  import ArrowRightIcon from "@/lib/icons/ArrowRightIcon.svelte";
  import PhotoSlider from "./CustomPoints/PhotoSlider.svelte";

  let { i18n } = $props();

  /**
   * Normalized article for the popup.
   * Two sources: user-created points (customPointsState) and built-in articles (articlesMeta + translations).
   *
   * isHtml: built-in descriptions are trusted HTML from translations, user text is plain text
   * and must never be rendered with {@html}.
   */
  const article = $derived.by(() => {
    const id = articlePopupState.id;

    if (!id) return null;

    const customPoint = customPointsState.getById(id);

    if (customPoint) {
      return {
        photos: customPoint.photos,
        photoSource: "custom",
        title: customPoint.title,
        text: customPoint.description,
        isHtml: false,
        coords: [customPoint.coords.lat, customPoint.coords.lng], // [lat, lon] like in articlesMeta
      };
    }

    const meta = articlesMeta.find((a) => a.id === id);

    if (!meta) return null;

    return {
      // Empty entries (no photo yet for this place) are dropped, same shape for both sources
      photos: meta.photos.filter(Boolean),
      photoSource: "asset",
      title: $i18n.t(`articles:${meta.id}:title`),
      text: $i18n.t(`articles:${meta.id}:description`),
      isHtml: true,
      coords: meta.coords,
    };
  });

  function getToMap(coords) {
    const [lat, lon] = coords;
    const search = new URLSearchParams({
      lon: String(lon),
      lat: String(lat),
    });

    goto(`/?${search.toString()}`);
  }
</script>

<Popup opened={articlePopupState.isOpen}>
  <Page>
    <Navbar>
      {#snippet left()}
        <NavbarBackLink onClick={articlePopupState.close} />
      {/snippet}
    </Navbar>

    {#if article}
      <Block class="pb-safe-4 text-base leading-relaxed">
        {#if article.photos.length > 0}
          <!-- Keyed by the article id: PhotoSlider/PhotoViewer keep their own open/zoom state
               internally, and it must not survive a switch to a different article -->
          {#key articlePopupState.id}
            <PhotoSlider
              {i18n}
              photos={article.photos}
              source={article.photoSource}
              alt={article.title}
              class="h-60 w-full rounded-2xl object-cover"
            />
          {/key}
        {/if}

        <h1 class="mb-4 mt-6 text-bold text-2xl text-neutral-800 dark:text-neutral-300">
          {article.title}
        </h1>

        <p class="text-neutral-800 dark:text-neutral-300" class:whitespace-pre-line={!article.isHtml}>
          {#if article.isHtml}
            {@html article.text}
          {:else}
            {article.text}
          {/if}
        </p>

        <Button
          small
          raised
          rounded
          class="k-color-brand-blue mt-4 ml-auto w-auto justify-between text-md"
          onClick={() => {
            articlePopupState.close();
            getToMap(article.coords);
          }}
        >
          <span> {$i18n.t("ui:buttons:toMaps")} </span>

          <ArrowRightIcon className="size-5" />
        </Button>
      </Block>
    {/if}
  </Page>
</Popup>
