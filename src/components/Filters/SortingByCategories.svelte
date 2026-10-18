<script>
  import { List, ListItem, BlockTitle, Radio } from "konsta/svelte";
  import { onMount } from "svelte";

  // Safe Capacitor storage helpers (string in / string out)
  import { setStorage, getStorage } from "@/capacitor/utils/appStorage";
  import { createLogger, IS_DEBUG } from "@/utils/debugMode";

  const sortingByCategoriesLogger = createLogger("SortingByCategories");

  // Props (Svelte 5)
  let {
    i18n,
    items = [], // source list to derive available categories
    categoryKey = "category", // key holding category id inside items
    i18nPrefix = "ui:sidePanel:handbook:filters:category", // i18n key prefix
    storageKey = "handbook.category", // Capacitor storage key for the single selected category
    onSelectedChange = null, // callback: (id: string) => void
  } = $props();

  // Local state
  const allId = "all";
  let selectedId = $state(allId); // currently selected category id
  let categoryIds = $state([]); // available category ids (excluding "all")
  let lastEmitted = $state(""); // last value sent to parent (prevents duplicate emits)
  let lastSaved = $state("");
  // Set once the user changes the category: the restore in onMount arrives later and must not undo it
  let isPickedByUser = false;

  // Build unique, sorted category list from items
  function getCategoryIds(list) {
    // A throw-away collection for the sort below, not state: nothing reactive reads it
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
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

  // Persist current selection to Capacitor storage
  function saveIfChanged(id) {
    if (id === lastSaved) return;
    lastSaved = id;
    setStorage(storageKey, id);
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
    // A radio fires only when it becomes checked, so this is always a real change
    isPickedByUser = true;
    applySelection(id);
  }

  // Initialize selection from localStorage (once on mount)
  onMount(async () => {
    try {
      const raw = await getStorage(storageKey);
      if (isPickedByUser) {
        IS_DEBUG && sortingByCategoriesLogger.log("Category already picked by the user, restore skipped");
        return;
      }

      const stored = typeof raw === "string" && raw ? raw : allId;

      applySelection(stored);
    } catch (error) {
      // The stored selection could not be read: falls back to "all categories" (already applied above)
      IS_DEBUG && sortingByCategoriesLogger.error("Failed to read the stored category:", error);
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
