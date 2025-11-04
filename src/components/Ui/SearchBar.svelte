<script>
  import { Searchbar } from "konsta/svelte";

  // i18Next
  import { i18nStores } from "@/services/i18n";
  const { i18n } = i18nStores;

  let {
    items = [],
    nameSpace = "articles",
    fields = ["title", "description"],
    value = $bindable(""),
    onQueryChange = null,
    onResults = null,
  } = $props();

  // String normalization
  const normalizeString = (s) =>
    (s ?? "")
      .toString()
      .toLowerCase()
      .normalize("NFD") // разложить диакритику
      .replace(/\p{Diacritic}/gu, "") // убрать диакритику
      .replace(/\s+/g, " ") // схлопнуть пробелы
      .trim();

  const translatedIndex = $derived.by(() => {
    return items.map((item) => {
      const parts = fields.map((f) => $i18n.t(`${nameSpace}:${item.id}:${f}`) || "");

      return { item: item, haystack: normalizeString(parts.join(" ")) };
    });
  });

  // emiter
  function emitResults(list) {
    if (typeof onResults === "function") onResults(list);
  }

  function notifyQuery(q) {
    if (typeof onQueryChange === "function") onQueryChange(q);
  }

  function computedAndEmit(query) {
    const nq = normalizeString(query);

    if (!nq) {
      emitResults(items.slice()); // all elements
      return;
    }

    const filtered = translatedIndex.filter((row) => row.haystack.includes(nq)).map((row) => row.item);

    emitResults(filtered);
  }

  // Initialization
  $effect(() => {
    computedAndEmit(value);
  });

  function handleSearch(e) {
    value = e?.target?.value ?? "";
    notifyQuery(value);
    computedAndEmit(value);
  }

  function handleClear() {
    value = "";
    notifyQuery("");
    emitResults(items.slice());
  }
</script>

<Searchbar
  {value}
  placeholder={$i18n.t("ui:searchbar:placeholder")}
  onInput={handleSearch}
  onClear={handleClear}
  disableButton
  disableButtonText={$i18n.t("ui:searchbar:cancel")}
/>
