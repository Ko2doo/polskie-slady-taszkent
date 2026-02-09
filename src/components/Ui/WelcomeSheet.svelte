<script>
  import { Block, Link, Page, Navbar, Button, Dialog } from "konsta/svelte";
  import Close from "@/lib/icons/Close.svelte";
  import { createToggle } from "@/lib/state/createToggler.svelte";
  import LangSwitcher from "./LangSwitcher.svelte";
  import DarkModeToggler from "./DarkModeToggler.svelte";

  let { i18n, appState, makeCompleted } = $props();

  // Toggler
  const sheetToggler = createToggle();

  let activeStep = $state("step-1");
  let isTabbarLabels = $state(true);

  $effect(() => {
    if ($appState === true) sheetToggler.set(true);
    if ($appState === false) sheetToggler.set(false);
  });

  // $inspect($appState);
</script>

<Dialog class="size-full" backdrop={false} opened={sheetToggler.value}>
  {#snippet title()}
    <h1 class="text-xl font-medium text-center">Окно быстрой настройки</h1>
  {/snippet}

  {#if activeStep === "step-1"}
    <Block strong inset class="mt-8 mb-4">
      <p class="text-lg font-medium text-center">Добро пожаловать в справочник с оффлайн навигацией!</p>

      <p class="text-md mt-4 mb-8">
        Здесь Вы узнаете о судьбах поляков, живших на территории Туркистанского ханства (современный Узбекистан,
        г.Ташкент), их вкладе в культуру и развитие региона.
      </p>

      <p class="text-lg font-medium mb-2">Предлагаем Вам настроить некоторые параметры приложения ниже:</p>
      <div class="flex items-center justify-between text-md">
        Выберите язык: <div class="size-min"><LangSwitcher {i18n} /></div>
      </div>

      <p class="text-md">Выберите тему:</p>
      <DarkModeToggler {i18n} />

      <div class="buttons-block pt-2 pb-2 w-full flex gap-2 justify-end">
        <Button inline rounded raised large onClick={() => (activeStep = "step-2")}>Далее</Button>
      </div>
    </Block>
  {/if}

  {#if activeStep === "step-2"}
    <Block nested class="mt-2 mb-4">
      <div class="buttons-block pt-2 pb-2 w-full flex gap-2 justify-end">
        <Button inline rounded raised large onClick={() => (activeStep = "step-1")}>Назад</Button>
        <Button inline rounded raised large onClick={() => (activeStep = "step-3")}>Далее</Button>
      </div>
    </Block>
  {/if}

  {#if activeStep === "step-3"}
    <Block nested class="mt-2 mb-4">
      <div class="buttons-block pt-2 pb-2 w-full flex gap-2 justify-end">
        <Button inline rounded raised large onClick={() => (activeStep = "step-2")}>Назад</Button>
        <Button inline rounded raised large onClick={() => makeCompleted()}>Завершить настройку</Button>
      </div>
    </Block>
  {/if}
</Dialog>
