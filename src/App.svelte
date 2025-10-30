<script>
  import { App, Page, Navbar, Block } from "konsta/svelte";

  // router
  import { Router } from "@mateothegreat/svelte5-router";
  import { routes } from "@/Routes";

  // Components
  import BottomTabbarNav from "@/components/Ui/BottomTabbarNav.svelte";
  import { navbarState } from "@/store/ui/navbar";

  // Local reactive state from Navbar:
  let title = $state("");
  let showSearch = $state(false);
  let showFavorites = $state(false);

  // Subscribe in navbarState store
  $effect(() => {
    const unsubscribe = navbarState.subscribe(($nb) => {
      // Every time someone calls setNavbar(...),
      // this callback receives the new state

      title = $nb?.title ?? "";
      (showSearch = $nb?.showSearch ?? false), (showFavorites = $nb?.showFavorites ?? false);
    });

    return () => unsubscribe();
  });
</script>

<App theme="ios" safeAreas>
  <Page class="flex flex-col min-h-[100dvh] !p-0">
    <Navbar {title} />

    <!-- Centered content -->
    <main class="flex-1 overflow-y-auto pb-[56px]">
      <Router {routes} />
    </main>

    <!-- Fixed bottom navigation -->
    <BottomTabbarNav />
  </Page>
</App>
