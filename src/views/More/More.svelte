<script>
  import { Block, MenuList, MenuListItem } from "konsta/svelte";
  import { fly } from "svelte/transition";

  import { withNavbar } from "@/store/ui/navbar";
  import { withTabbar } from "@/store/ui/bottomTabbarNav";
  import { resolvePageKeyFromRouteResult } from "@/utils/routerUtils";

  import { goto } from "@mateothegreat/svelte5-router";

  // Icons
  import SettingsIcon from "@/lib/icons/SettingsIcon.svelte";
  import InfoSquareIcon from "@/lib/icons/InfoSquareIcon.svelte";
  import CodeIcon from "@/lib/icons/CodeIcon.svelte";
  import SvelteIcon from "@/lib/icons/SvelteIcon.svelte";
  import GitIcon from "@/lib/icons/GitIcon.svelte";

  // router props
  let { i18n, appName = "", version = "" } = $props();

  $effect(() => {
    const dispose = withNavbar({
      title: appName,
      showSidePanel: false,
      leftSnippet: false,
    });

    return dispose;
  });

  $effect(() => {
    // Default tabbar state
    withTabbar({
      isVisible: true,
      duration: 120,
      delay: 40,
    });
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
      icon: InfoSquareIcon,
    },
    {
      id: "technicalInfo",
      href: "/technical-info",
      icon: CodeIcon,
    },
  ];
</script>

<section class="more-view flex flex-col min-h-[100%] pb-safe-24" in:fly={{ duration: 120, y: -20 }}>
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

  <div class="flex items-center justify-center flex-col gap-[4px] mt-auto">
    <p class="text-xs text-gray-900 dark:text-stone-300">
      App Version: {version}
    </p>

    <div class="flex items-center text-xs text-gray-900 dark:text-stone-300">
      <p class="mr-1">Powered by</p>
      <SvelteIcon className="size-4" /> Svelte
    </div>

    <a
      href="https://github.com/Ko2doo/polskie-slady-taszkent"
      class="text-sm font-bold text-blue-600 dark:text-blue-400 flex gap-2 items-center"
      target="_blank"
    >
      <GitIcon className="size-8 fill-black dark:fill-white" />
      <span class="pt-[1.2px]">{appName}</span>
    </a>
  </div>
</section>
