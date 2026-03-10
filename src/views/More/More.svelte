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
  import SvelteIcon from "@/lib/icons/SvelteIcon.svelte";

  // router props
  let { i18n, version = "" } = $props();

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

<section class="more-view flex flex-col min-h-[100%]" in:fly={{ duration: 120, y: -20 }}>
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

  <div class="flex items-center justify-center flex-col gap-[4px] pb-4 mt-auto">
    <div class="flex items-center text-xs text-gray-900 dark:text-stone-300">
      <p class="mr-1">Powered by</p>
      <SvelteIcon className="size-4" /> Svelte
    </div>

    <p class="text-xs text-gray-900 dark:text-stone-300">
      Version: {version}
    </p>
  </div>
</section>
