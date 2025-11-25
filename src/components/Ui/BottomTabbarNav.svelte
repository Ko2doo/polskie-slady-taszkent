<script>
  /**
   * This is custom bottom navigation (Tabbar)
   */

  import { Icon } from "konsta/svelte";
  import { route as linkAction } from "@mateothegreat/svelte5-router";

  // Icons
  import HandbookIcon from "@/lib/icons/HandbookIcon.svelte";
  import AboutUsIcon from "@/lib/icons/AboutUsIcon.svelte";
  import PaperMapIcon from "@/lib/icons/PaperMapIcon.svelte";

  let { i18n } = $props();

  // Router link params
  // Check https://github.com/mateothegreat/svelte5-router/blob/main/docs/actions.md#route
  const routeParam = {
    active: {
      class: [
        "bg-black/10",
        "rounded-[inherit]",
        "overflow-visible",
        "dark:bg-white/15",
        "text-blue-600",
        "dark:text-blue-600",
        "font-bold",
      ],
      absolute: true,
    },
  };

  // Navigation collection
  const linksParams = [
    {
      id: "handbook",
      href: "/",
      icon: HandbookIcon,
    },
    {
      id: "map",
      href: "/map",
      icon: PaperMapIcon,
    },
    {
      id: "about",
      href: "/about",
      icon: AboutUsIcon,
    },
  ];
</script>

<nav class="pb-safe-4 px-safe-4 flex justify-center w-full z-20">
  <div class="gap-4 items-stretch h-16 w-full md:w-auto flex justify-between">
    <div
      class="bg-ios-light-glass shadow-ios-light-glass backdrop-blur-lg touch-none dark:bg-ios-dark-glass dark:shadow-ios-dark-glass flex justify-between items-center h-full rounded-full w-full md:w-auto p-1"
    >
      {#each linksParams as link (link.id)}
        <a
          href={link.href}
          use:linkAction={routeParam}
          class="active:opacity-50 k-link inline-flex flex-col justify-center items-center cursor-pointer select-none px-4 text-xs truncate w-full h-full duration-300 transition-colors rounded-full"
        >
          <!-- Render icons (if it exists iconCollection) -->
          <Icon class="mb-1">
            <!-- Check this: https://svelte.dev/docs/svelte/compiler-warnings#svelte_component_deprecated -->
            {@const IconComponent = link.icon}
            <IconComponent className="w-7 h-7" strokeColor="currentColor" />
          </Icon>

          <!-- Render locales for id -->
          {$i18n.t(`ui:navbar:${link.id}:title`)}
        </a>
      {/each}
    </div>
  </div>
</nav>
