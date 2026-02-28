<script>
  import { withNavbar } from "@/store/ui/navbar";
  import { resolvePageKeyFromRouteResult } from "@/utils/routerUtils";
  import { Block, MenuList, MenuListItem } from "konsta/svelte";

  import { goto } from "@mateothegreat/svelte5-router";

  // Icons
  import SettingsIcon from "@/lib/icons/SettingsIcon.svelte";
  import AboutUsIcon from "@/lib/icons/AboutUsIcon.svelte";

  // router props
  let { route, i18n } = $props();

  // Inspector check console in browser
  // $inspect(route);

  $effect(() => {
    const result = route?.result;
    // console.log(result);

    // get "pageKey" from route path
    //    "/about" -> "about"
    //    "/handbook" -> "handbook"
    const pageKey = resolvePageKeyFromRouteResult(result);

    /* prettier-ignore */
    const title = pageKey
      ? $i18n.t(`ui:navbar:${pageKey}:title`)
      : "";

    const dispose = withNavbar({
      title: title || pageKey,
      showSidePanel: false,
      leftSnippet: false,
    });

    return dispose;
  });

  const menu = [
    {
      id: "settingsTitle",
      href: "/settings",
      icon: SettingsIcon,
    },
    {
      id: "aboutTitle",
      href: "/about",
      icon: AboutUsIcon,
    },
  ];
</script>

<Block strong inset>
  <MenuList>
    {#each menu as menuItem (menuItem.id)}
      <MenuListItem
        title={$i18n.t(`ui:more:menuListItem:${menuItem.id}`)}
        active={false}
        dividers={true}
        onClick={() => goto(menuItem.href)}
      >
        {#snippet media()}
          <!-- Check this: https://svelte.dev/docs/svelte/compiler-warnings#svelte_component_deprecated -->
          {@const IconComponent = menuItem.icon}
          <IconComponent className="size-6" strokeColor="currentColor" />
        {/snippet}
      </MenuListItem>
    {/each}
  </MenuList>
</Block>
