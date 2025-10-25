<script>
  /**
   * This is a routing navigation component
   */

  import { Page, Toolbar, ToolbarPane, Link } from "konsta/svelte";
  import { route } from "@mateothegreat/svelte5-router";

  // Router link params
  const routeParam = {
    // default: { class: ["text-gray-600"] },
    active: {
      class: ["k-tabbar-link-active", "text-blue-600", "font-bold"],
      absolute: true,
    },
  };

  // Navigation collection
  const links = [
    {
      href: "/",
      label: "Home",
    },
    {
      href: "/handbook",
      label: "Handbook",
    },
    {
      href: "/about",
      label: "About",
    },
  ];
</script>

<Toolbar top={false}>
  <ToolbarPane>
    {#each links as link}
      <a
        href={link.href}
        class="active:opacity-50 k-link inline-flex gap-1 justify-center items-center cursor-pointer select-none px-4 truncate w-full h-full duration-300 transition-colors relative"
        use:route={routeParam}
      >
        {link.label}
      </a>
    {/each}
  </ToolbarPane>
</Toolbar>
