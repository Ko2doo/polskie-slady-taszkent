<script>
  import { Searchbar } from "konsta/svelte";

  /**
   * Props
   * - items: the raw dataset to search over (array of objects; each item must have an `id`)
   * - nameSpace: i18n namespace where translated fields live, e.g. `${nameSpace}:${item.id}:${field}`
   * - fields: which translated fields of each item participate in search (joined into one haystack)
   * - value: the current query string (two-way bound via $bindable)
   * - onQueryChange: optional callback invoked on every query change
   * - onResults: optional callback invoked with the computed result list
   */
  let {
    i18n,
    items = [],
    nameSpace = "articles",
    fields = ["title", "description"],
    value = $bindable(""),
    shouldFocus = false,
    onHideBar = () => {},
    onQueryChange = null,
    onResults = null,
  } = $props();

  let inputEl = $state(null);

  $effect(() => {
    if (shouldFocus === true) {
      const element = document.getElementById("searchbarInput");
      if (element) element.focus();
    }
  });

  /**
   * normalizeString
   * Normalizes a string for matching:
   * - ensures string type
   * - lowercases
   * - removes diacritics (NFD + strip combining marks)
   * - collapses multiple spaces
   * - trims ends
   * Result: a canonicalized form suitable for inclusion tests.
   */
  const normalizeString = (s) =>
    (s ?? "")
      .toString()
      .toLowerCase()
      .normalize("NFD") // разложить диакритику
      .replace(/\p{Diacritic}/gu, "") // убрать диакритику
      .replace(/\s+/g, " ") // схлопнуть пробелы
      .trim();

  /**
   * translatedIndex (derived)
   * Builds a searchable index from `items` + i18n translations.
   * For each item:
   *  - pulls translated strings for the configured `fields`
   *  - concatenates them into a single "haystack"
   *  - normalizes the haystack for robust matching
   * Structure: [{ item, haystack }, ...]
   * This recomputes when `items`, `fields`, `nameSpace`, or i18n data change.
   */
  const translatedIndex = $derived.by(() => {
    return items.map((item) => {
      const parts = fields.map((f) => $i18n.t(`${nameSpace}:${item.id}:${f}`) || "");

      return { item: item, haystack: normalizeString(parts.join(" ")) };
    });
  });

  // Helper: safely emit computed results to the parent if a callback is provided.
  function emitResults(list) {
    if (typeof onResults === "function") onResults(list);
  }

  // Helper: notify parent about query changes, if a handler is provided.
  function notifyQuery(q) {
    if (typeof onQueryChange === "function") onQueryChange(q);
  }

  /**
   * computedAndEmit
   * Computes filtered results based on the provided query and emits them.
   * - If query is empty after normalization -> return all items.
   * - Else, filter the derived index by substring inclusion in the normalized haystack.
   */
  function computedAndEmit(query) {
    const nq = normalizeString(query);

    if (!nq) {
      emitResults(items.slice()); // all elements
      return;
    }

    const filtered = translatedIndex.filter((row) => row.haystack.includes(nq)).map((row) => row.item);

    emitResults(filtered);
  }

  /**
   * Initialization effect
   * Runs once (and on dependencies if any appear), computing initial results
   * for the current `value` so consumers start with a consistent state.
   */
  $effect(() => {
    computedAndEmit(value);
  });

  /**
   * handleSearch
   * - Updates the local bound `value` from input event
   * - Notifies parent about the new query
   * - Recomputes and emits filtered results
   */
  function handleSearch(e) {
    value = e?.target?.value ?? "";
    notifyQuery(value);
    computedAndEmit(value);
  }

  /**
   * handleClear
   * - Resets the query to an empty string
   * - Notifies parent
   * - Emits all items (i.e., clears the filter)
   */
  function handleClear() {
    value = "";
    notifyQuery("");
    emitResults(items.slice());
    onHideBar();
  }
</script>

<Searchbar
  {value}
  placeholder={$i18n.t("ui:searchbar:placeholder")}
  inputId="searchbarInput"
  onInput={handleSearch}
  onClear={handleClear}
  disableButton
  disableButtonText={$i18n.t("ui:searchbar:cancel")}
/>
