<script>
  /**
   * This is a routing navigation component
   */

  import { Page, Toolbar, ToolbarPane, Link } from "konsta/svelte";
  import { route } from "@mateothegreat/svelte5-router";

  // Router link params
  // Check https://github.com/mateothegreat/svelte5-router/blob/main/docs/actions.md#route
  const routeParam = {
    // default: { class: ["text-gray-600"] },
    active: {
      class: ["toolbar-active-link", "text-blue-600", "font-bold"],
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
  <ToolbarPane class="p-1">
    {#each links as link}
      <a
        href={link.href}
        class="active:opacity-50 k-link inline-flex gap-1 justify-center items-center cursor-pointer select-none px-4 truncate w-full h-full duration-300 transition-colors relative rounded-full"
        use:route={routeParam}
      >
        {link.label}
      </a>
    {/each}
  </ToolbarPane>
</Toolbar>

<style lang="css">
  :global .toolbar-active-link {
    background-color: hsl(0deg 0% 86.71% / 80%);
    backdrop-filter: blur(10px);
  }
</style>
