<script>
  import { Block, NavbarBackLink } from "konsta/svelte";
  import { fly } from "svelte/transition";

  import { withNavbar } from "@/store/ui/navbar";
  import { setTabbar } from "@/store/ui/bottomTabbarNav";

  // Icons
  import Close from "@/lib/icons/Close.svelte";

  import { routerBack } from "@/services/navigationHistoryHook";

  import { technicalInfoMeta } from "@/data/about";
  import GitIcon from "@/lib/icons/GitIcon.svelte";

  let { i18n, appName = "" } = $props();

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
      {#each technicalInfoMeta as info (info.id)}
        {@const itemData = $i18n.t(`about:technicalInfo:${info.id}`, { returnObjects: true })}

        <div class="flex flex-col self-baseline gap-2 w-full">
          <b class="block text-[18px] text-stone-800 dark:text-stone-100">
            {itemData.title}
          </b>

          {#if info && "links" in info}
            <ul class="block w-full text-[16px]">
              {#each info.links as link}
                <li class="list-item list-none pb-[2px] text-stone-700 dark:text-stone-200">
                  <span>{link.title}:</span>
                  <a href={link.href} target="_blank" class="text-blue-600 font-bold">{link.label}</a>
                </li>
              {/each}
            </ul>
          {:else if Array.isArray(itemData.description)}
            {#each itemData.description as item}
              <p class="text-[16px] font-normal text-stone-700 dark:text-stone-200">
                {item}
              </p>
            {/each}
          {:else}
            <p class="text-[16px] font-normal text-stone-700 dark:text-stone-200">
              {itemData.description}
            </p>
          {/if}
        </div>
      {/each}

      <div class="flex flex-col self-baseline gap-2">
        <b class="block text-[18px] text-stone-800 dark:text-stone-100">
          {$i18n.t("about:repoLabel")}
        </b>
        <a
          href="https://github.com/Ko2doo/sp.polskie-slady-taszkent"
          class="text-blue-600 font-bold text-[16px] flex gap-2 items-center"
          target="_blank"
        >
          <GitIcon className="size-8 fill-black dark:fill-white" />
          <span class="pt-[2px]">{appName}</span>
        </a>
      </div>
    </article>
  </Block>
</section>
