<script>
  /**
   * This is custom bottom navigation (Tabbar)
   */

  import { Icon } from "konsta/svelte";
  import { route as linkAction, registry } from "@mateothegreat/svelte5-router";

  import { fly } from "svelte/transition";

  // Icons
  import HandbookIcon from "@/lib/icons/HandbookIcon.svelte";
  import PaperMapIcon from "@/lib/icons/PaperMapIcon.svelte";
  import MenuDotsIcon from "@/lib/icons/MenuDotsIcon.svelte";

  let { i18n, duration, delay } = $props();

  // Router link params
  // Check https://github.com/mateothegreat/svelte5-router/blob/main/docs/actions.md#route
  const routeParam = {
    active: {
      class: [
        "bg-black/10",
        "rounded-[inherit]",
        "overflow-visible",
        "dark:bg-white/15",
        "text-primary",
        // "text-blue-600",
        // "dark:text-blue-500",
        "font-bold",
      ],
      absolute: true,
    },
  };

  // Navigation collection
  const linksParams = [
    {
      id: "map",
      href: "/",
      icon: PaperMapIcon,
    },
    {
      id: "handbook",
      href: "/handbook",
      icon: HandbookIcon,
    },
    {
      id: "more",
      href: "/more",
      icon: MenuDotsIcon,
    },
  ];

  const currentPath = $derived(
    [...registry.instances.values()][0]?.current?.result?.path?.original ?? window.location.pathname,
  );

  function isActive(href) {
    if (href === "/") return currentPath === "/" || currentPath === "";
    return currentPath.startsWith(href);
  }
</script>

<nav
  class="pb-safe-4 px-safe-4 fixed bottom-0 flex justify-center w-full z-20"
  in:fly={{ duration: duration, delay: delay, y: 20 }}
  out:fly={{ duration: duration, delay: delay, y: 20 }}
>
  <div class="gap-4 items-stretch h-16 w-full md:w-auto flex justify-between">
    <div
      class="bg-ios-light-glass shadow-ios-light-glass backdrop-blur-lg touch-none dark:bg-ios-dark-glass dark:shadow-ios-dark-glass flex justify-between items-center h-full rounded-full w-full md:w-auto p-1"
    >
      {#each linksParams as link (link.id)}
        <a
          href={link.href}
          use:linkAction={routeParam}
          class="active:opacity-50 k-link inline-flex flex-col justify-center items-center cursor-pointer select-none px-4 text-[14px] truncate w-full h-full duration-120 transition-colors rounded-full"
        >
          <!-- Render icons (if it exists iconCollection) -->
          <Icon class="mb-1">
            <!-- Check this: https://svelte.dev/docs/svelte/compiler-warnings#svelte_component_deprecated -->
            {@const IconComponent = link.icon}
            <IconComponent className="size-7" strokeColor="currentColor" isActive={isActive(link.href)} />
          </Icon>

          <!-- Render locales for id -->
          {$i18n.t(`ui:navbar:${link.id}:title`)}
        </a>
      {/each}
    </div>
  </div>
</nav>
