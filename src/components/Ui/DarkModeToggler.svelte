<script>
  /*
    DarkModeToggler

    - Two-mode theme controller for Konsta UI.
    - Auto mode: follows system color scheme via prefers-color-scheme (no persisted value).
    - Manual mode: user-selected theme persisted via Capacitor Preferences (ui.theme = 'dark' | 'light').
    - Theme is applied by toggling the 'dark' class on <html>, which Konsta uses to render dark styles.
    - The "Dark theme" toggle is disabled while "Follow system" is enabled.
  */

  import { List, ListItem, Toggle } from "konsta/svelte";
  import { getStorage, setStorage, removeStorageItem } from "@/capacitor/utils/appStorage";

  let { i18n } = $props();

  const THEME_KEY = "ui.theme"; // 'dark' | 'light'
  const rootElement = document.documentElement;
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  // states
  let followSystem = $state(true);
  let isDark = $state(false);

  function applyTheme(nextIsDark) {
    isDark = nextIsDark;
    rootElement.classList.toggle("dark", nextIsDark);
  }

  // Init
  async function initTheme() {
    const value = await getStorage(THEME_KEY);

    if (value === "dark" || value === "light") {
      // manual
      followSystem = false;
      applyTheme(value === "dark");
      return;
    }

    // auto
    followSystem = true;
    applyTheme(mediaQuery.matches);
  }

  // Init once
  let didInit = false;
  $effect(() => {
    if (didInit) return;
    didInit = true;
    initTheme();
  });

  // System theme listener (auto only)
  $effect(() => {
    const handler = (event) => {
      if (!followSystem) return;
      applyTheme(event.matches);
    };

    mediaQuery.addEventListener("change", handler);

    return () => {
      mediaQuery.removeEventListener("change", handler);
    };
  });

  // Toggle: follow system
  async function onFollowSystemChange(value) {
    followSystem = value;

    if (value) {
      // Onn auto
      await removeStorageItem(THEME_KEY);
      applyTheme(mediaQuery.matches);
      return;
    }

    // Off auto -> fixes current state
    await setStorage(THEME_KEY, isDark ? "dark" : "light");
    applyTheme(isDark);
  }

  // Toggle: dark mode (manual only)
  async function onThemeToggle(value) {
    if (followSystem) return;

    applyTheme(value);
    await setStorage(THEME_KEY, value ? "dark" : "light");
  }
</script>

<List strong inset>
  <ListItem
    colors={{ primaryTextIos: "text-stone-800 dark:text-stone-300" }}
    title={$i18n.t("ui:settings:appearance:followSystem")}
  >
    {#snippet after()}
      <Toggle checked={followSystem} onChange={(e) => onFollowSystemChange(e.target.checked)} />
    {/snippet}
  </ListItem>

  <ListItem
    colors={{ primaryTextIos: "text-stone-800 dark:text-stone-300" }}
    title={$i18n.t("ui:settings:appearance:darkMode")}
    disabled={followSystem}
  >
    {#snippet after()}
      <Toggle checked={isDark} disabled={followSystem} onChange={(e) => onThemeToggle(e.target.checked)} />
    {/snippet}
  </ListItem>
</List>
