<script>
  import { App, Page, Navbar, Block } from "konsta/svelte";

  // router
  import { Router } from "@mateothegreat/svelte5-router";
  import { routes } from "@/Routes";

  // Components
  import BottomToolbar from "@/components/Ui/BottomToolbar.svelte";
</script>

<App theme="ios" safeAreas>
  <Page class="flex flex-col min-h-[100dvh] !p-0">
    <!-- Centered content -->
    <main class="flex-1 overflow-y-auto pb-[56px]">
      <Router {routes} />
    </main>

    <!-- Fixed bottom navigation -->
    <BottomToolbar />
  </Page>
</App>
