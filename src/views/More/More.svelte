<script>
  import { Block, MenuList, MenuListItem } from "konsta/svelte";
  import { fly } from "svelte/transition";

  import { withNavbar } from "@/store/ui/navbar";
  import { resetTabbar } from "@/store/ui/bottomTabbarNav";
  import { resolvePageKeyFromRouteResult } from "@/utils/routerUtils";

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

  $effect(() => {
    // Default tabbar state
    resetTabbar();
  });

  const menu = [
    {
      id: "settings",
      href: "/settings",
      icon: SettingsIcon,
    },
    {
      id: "about",
      href: "/about",
      icon: AboutUsIcon,
    },
  ];
</script>

<section class="more-view" in:fly={{ duration: 120, y: 20 }}>
  <Block nested>
    <figure class="logo-wrapper flex flex-col items-center">
      <img src="/project-logo.png" alt="Project logo" />

      <figcaption class="mt-4 text-center">
        {@html $i18n.t("about:shortInfo")}
      </figcaption>
    </figure>
  </Block>

  <Block strong inset>
    <MenuList nested>
      {#each menu as menuItem (menuItem.id)}
        <MenuListItem
          active={false}
          dividers={true}
          onClick={() => goto(menuItem.href)}
          linkProps={{ "data-link-id": menuItem.id }}
        >
          {#snippet media()}
            <!-- Check this: https://svelte.dev/docs/svelte/compiler-warnings#svelte_component_deprecated -->
            {@const IconComponent = menuItem.icon}
            <IconComponent className="size-8" strokeColor="currentColor" />
          {/snippet}

          {#snippet title()}
            <p class="text-[18px]">
              {$i18n.t(`ui:more:menuListItem:${menuItem.id}Title`)}
            </p>
          {/snippet}
        </MenuListItem>
      {/each}
    </MenuList>
  </Block>
</section>
