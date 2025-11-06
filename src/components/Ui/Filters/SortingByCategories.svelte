<script>
  import { List, ListItem, BlockTitle, Radio } from "konsta/svelte";
  import { onMount } from "svelte";

  // i18n
  import { i18nStores } from "@/services/i18n";
  const { i18n } = i18nStores;

  // Safe localStorage helpers (string in / string out)
  import { setLocalStorage, getLocalStorage } from "@/utils/localeStorageUtils";

  // Props (Svelte 5)
  let {
    items = [], // source list to derive available categories
    categoryKey = "category", // key holding category id inside items
    i18nPrefix = "ui:sidePanel:handbook:filters:category", // i18n key prefix
    localStorageKey = "handbook.category", // localStorage key for the single selected category
    onSelectedChange = null, // callback: (id: string) => void
    allId = "all", // special id meaning “show all categories”
  } = $props();

  // Local state
  let selectedId = $state(allId); // currently selected category id
  let categoryIds = $state([]); // available category ids (excluding "all")
  let lastEmitted = $state(""); // last value sent to parent (prevents duplicate emits)
  let lastSaved = $state("");

  // Build unique, sorted category list from items
  function getCategoryIds(list) {
    const s = new Set();

    for (const it of list) {
      const v = it?.[categoryKey];
      if (v) s.add(v);
    }

    return Array.from(s).sort();
  }

  // Emit to parent only if value actually changed
  function emitIfChanged(id) {
    if (id === lastEmitted) return;

    lastEmitted = id;

    if (typeof onSelectedChange === "function") onSelectedChange(id);
  }

  // Persist current selection to localStorage
  function saveIfChanged(id) {
    if (id === lastSaved) return;

    try {
      setLocalStorage(localStorageKey, id);
      lastSaved = id;
    } catch (error) {
      console.error(error);
    }
  }

  // Single entry point to apply a selection
  function applySelection(id, { persist = true, notify = true } = {}) {
    if (id === selectedId) return;

    selectedId = id;
    if (persist) saveIfChanged(selectedId);
    if (notify) emitIfChanged(selectedId);
  }

  // User selection (radio)
  function select(id) {
    applySelection(id);
  }

  // Initialize selection from localStorage (once on mount)
  onMount(() => {
    try {
      const raw = getLocalStorage(localStorageKey);
      const stored = typeof raw === "string" && raw ? raw : allId;

      applySelection(stored);
      saveIfChanged(stored);
    } catch (error) {
      console.error(error);
    }
  });

  // Recompute category list when items change; validate current selection
  $effect(() => {
    const nextCats = getCategoryIds(items);
    categoryIds = nextCats; // refresh categories for UI

    // If current selection disappeared, fall back to "all" and notify parent
    const allowed = new Set([allId, ...nextCats]);

    if (!allowed.has(selectedId)) {
      applySelection(allId);
    }
  });
</script>

<BlockTitle>{$i18n.t("ui:sidePanel:handbook:filters:categoryTitle")}</BlockTitle>

<List inset>
  <ListItem label title={$i18n.t(`${i18nPrefix}:${allId}`)}>
    {#snippet media()}
      <Radio name="handbook-category" checked={selectedId === allId} onChange={() => select(allId)} />
    {/snippet}
  </ListItem>

  {#each categoryIds as cid (cid)}
    <ListItem label title={$i18n.t(`${i18nPrefix}:${cid}`)}>
      {#snippet media()}
        <Radio name="handbook-category" checked={selectedId === cid} onChange={() => select(cid)} />
      {/snippet}
    </ListItem>
  {/each}
</List>
