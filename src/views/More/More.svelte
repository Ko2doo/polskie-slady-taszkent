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
  import CodeSquareIcon from "@/lib/icons/CodeSquareIcon.svelte";

  // router props
  let { i18n } = $props();

  $effect(() => {
    const dispose = withNavbar({
      title: "Polskie Ślady Taszkent",
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
    {
      id: "technicalInfo",
      href: "/technical-info",
      icon: CodeSquareIcon,
    },
  ];
</script>

<section class="more-view" in:fly={{ duration: 120, y: 20 }}>
  <Block nested>
    <article class="logo-wrapper flex flex-col items-center">
      <img src="app-icon.png" alt="Project logo" class="size-24" />

      <p class="mt-4 text-base text-center">
        {@html $i18n.t("about:shortInfo")}
      </p>
    </article>
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
            <IconComponent className="size-7" strokeColor="currentColor" />
          {/snippet}

          {#snippet title()}
            <p class="text-[17px]">
              {$i18n.t(`ui:more:menuListItem:${menuItem.id}Title`)}
            </p>
          {/snippet}
        </MenuListItem>
      {/each}
    </MenuList>
  </Block>
</section>
