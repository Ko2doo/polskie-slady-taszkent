<script>
  /**
   * Map markers filter subcomponent (all / custom / historical)
   */

  import { List, ListItem, BlockTitle, Radio } from "konsta/svelte";
  import { MARKER_FILTER, mapMarkerFilter } from "@/lib/state/mapMarkerFilter.svelte";

  // Props (Svelte 5)
  let { i18n } = $props();

  const filterIds = Object.values(MARKER_FILTER);
</script>

<BlockTitle>{$i18n.t("ui:sidePanel:map:filters:markersTitle")}</BlockTitle>

<List inset>
  {#each filterIds as id (id)}
    <ListItem label title={$i18n.t(`ui:sidePanel:map:filters:${id}`)}>
      {#snippet media()}
        <Radio
          name="map-markers"
          checked={mapMarkerFilter.selected === id}
          onChange={() => mapMarkerFilter.select(id)}
        />
      {/snippet}
    </ListItem>
  {/each}
</List>
