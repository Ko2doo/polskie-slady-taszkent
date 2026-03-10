<script>
  import { Block, NavbarBackLink } from "konsta/svelte";
  import { fly } from "svelte/transition";

  import { withNavbar } from "@/store/ui/navbar";
  import { setTabbar } from "@/store/ui/bottomTabbarNav";

  // Icons
  import Close from "@/lib/icons/Close.svelte";

  import { routerBack } from "@/services/navigationHistoryHook";

  import { aboutMeta } from "@/data/about";

  let { i18n } = $props();

  $effect(() => {
    const dispose = withNavbar({
      title: $i18n.t(`ui:navbar:technicalInfo:title`),
      showSidePanel: false,
      leftSnippet: BackButton,
    });

    return dispose;
  });

  $effect(() => {
    setTabbar({
      isVisible: false,
    });
  });

  function handleBack() {
    routerBack("/");
  }
</script>

{#snippet BackButton()}
  <NavbarBackLink text="Back" onClick={handleBack} />
{/snippet}

<section class="about-view relative z-60 flex flex-col" in:fly={{ duration: 120, x: 20 }}>
  <Block strong inset>
    <article class="flex flex-col pt-4 pb-4 gap-8">
      <!-- {#each aboutMeta as info (info.id)}

        <div class="flex flex-col self-baseline gap-2">
          <b class="block text-[18px]">
            {$i18n.t(`about:fullInfo:${info.id}:title`)}
          </b>

          <p class="text-[16px] font-normal">
            {$i18n.t(`about:fullInfo:${info.id}:description`)}
          </p>
        </div>
      {/each} -->
      Зависимости и т.д.
    </article>
  </Block>
</section>
