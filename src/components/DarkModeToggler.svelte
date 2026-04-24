<script>
  /**
   * DarkModeToggler (Settings UI)
   *
   * UI-only component that controls global theme manager.
   * - "Follow system" toggle switches between Auto and Manual modes.
   * - "Dark theme" toggle is disabled in Auto mode.
   * - All actual theme logic (DOM class + persistence + system listener)
   *   is implemented in the singleton theme manager.
   */

  import { onMount, onDestroy } from "svelte";
  import { fly } from "svelte/transition";
  import { List, ListItem, Toggle } from "konsta/svelte";

  import { getThemeManager } from "@/lib/theme/themeManager";

  let { i18n, ...listSettings } = $props();

  // states
  let followSystem = $state(true);
  let isDark = $state(false);

  const theme = getThemeManager();

  // Subscribe once, keep toggles in sync with global theme state
  $effect(() => {
    return theme.subscribe((s) => {
      followSystem = s.followSystem;
      isDark = s.isDark;
    });
  });

  // Toggle handlers
  const onFollowSystemChange = (e) => theme.setFollowSystem(e.target.checked);
  const onDarkChange = (e) => theme.setDark(e.target.checked);
</script>

<List {...listSettings}>
  <ListItem
    colors={{ primaryTextIos: "text-stone-800 dark:text-stone-300" }}
    title={$i18n.t("ui:settings:appearance:followSystem")}
  >
    {#snippet after()}
      <Toggle checked={followSystem} onChange={onFollowSystemChange} />
    {/snippet}
  </ListItem>

  {#if !followSystem}
    <li in:fly={{ duration: 120, y: -20 }} class="list-none">
      <ListItem
        component="div"
        dividers={false}
        colors={{ primaryTextIos: "text-stone-800 dark:text-stone-300" }}
        title={$i18n.t("ui:settings:appearance:darkMode")}
        disabled={followSystem}
      >
        {#snippet after()}
          <Toggle checked={isDark} disabled={followSystem} onChange={onDarkChange} />
        {/snippet}
      </ListItem>
    </li>
  {/if}
</List>
