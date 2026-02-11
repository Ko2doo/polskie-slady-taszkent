<script>
  import { Dialog, Block, Button } from "konsta/svelte";
  import { createToggle } from "@/lib/state/createToggler.svelte";
  import { Geolocation } from "@capacitor/geolocation";

  import LangSwitcher from "./LangSwitcher.svelte";
  import DarkModeToggler from "./DarkModeToggler.svelte";

  import TranslateIcon from "@/lib/icons/TranslateIcon.svelte";
  import PaletteIcon from "@/lib/icons/PaletteIcon.svelte";
  import GPSIcon from "@/lib/icons/GPSIcon.svelte";

  let { i18n, appState, makeCompleted } = $props();

  // Toggler
  const welcomeDialogToggler = createToggle();

  let activeStep = $state(1);
  let isRequestingPermission = $state(false);
  let permissionStatus = $state(null);

  const TOTAL_STEPS = 2;

  $effect(() => {
    if ($appState === true) welcomeDialogToggler.set(true);
    if ($appState === false) welcomeDialogToggler.set(false);
  });

  async function checkLocationPermission() {
    try {
      const permission = await Geolocation.checkPermissions();
      permissionStatus = permission.location;
      return permission.location === "granted";
    } catch (error) {
      console.error("Permission check failed:", error);
      return false;
    }
  }

  async function requestLocationPermission() {
    isRequestingPermission = true;
    try {
      const permission = await Geolocation.requestPermissions();
      permissionStatus = permission.location;

      if (permission.location === "granted") {
        await completeOnboarding();
      } else if (permission.location === "denied") {
        alert($i18n.t("onboarding.location.deniedMessage"));
      }
    } catch (error) {
      console.error("Permission request failed:", error);
      alert($i18n.t("onboarding.location.errorMessage"));
    } finally {
      isRequestingPermission = false;
    }
  }

  async function completeOnboarding() {
    try {
      await makeCompleted();
      welcomeDialogToggler.set(false);
    } catch (error) {
      console.error("Failed to complete onboarding:", error);
      alert("Не удалось сохранить настройки. Попробуйте ещё раз.");
    }
  }

  function nextStep() {
    if (activeStep < TOTAL_STEPS) {
      activeStep++;
    }
  }

  function prevStep() {
    if (activeStep > 1) {
      activeStep--;
    }
  }
</script>

<Dialog class="w-full" backdrop={true} opened={welcomeDialogToggler.value}>
  {#snippet title()}
    <div class="flex flex-col items-center gap-1">
      <h1 class="text-xl font-semibold">
        {activeStep === 1 ? $i18n.t("ui:dialog:onboarding:step1Title") : $i18n.t("ui:dialog:onboarding:step2Title")}
      </h1>
      <p class="text-xs text-gray-500">
        {$i18n.t("ui:dialog:onboarding:step")}
        {activeStep}
        {$i18n.t("ui:dialog:onboarding:stepOf")}
        {TOTAL_STEPS}
      </p>
    </div>
  {/snippet}

  <Block inset nested class="px-4">
    {#if activeStep === 1}
      <div class="space-y-4">
        <p class="text-base leading-relaxed">
          {$i18n.t("ui:dialog:onboarding:step1Info")}
        </p>

        <div class="space-y-2">
          <p class="flex items-center text-lg font-medium text-gray-700 dark:text-gray-300">
            {$i18n.t("ui:dialog:onboarding:step1Settings")}
          </p>

          <div class="flex items-center justify-between">
            <span class="flex text-[16px]">
              <TranslateIcon className="size-5 mr-2" />
              {$i18n.t("ui:dialog:onboarding:step1Locales")}
            </span>
            <div class="size-min"><LangSwitcher raise={true} rounded={true} {i18n} /></div>
          </div>

          <div class="flex flex-col">
            <p class="flex items-center text-[16px]">
              <PaletteIcon className="size-5 mr-2" />
              {$i18n.t("ui:dialog:onboarding:step1Appearance")}
            </p>
            <DarkModeToggler inset={true} nested={true} {i18n} />
          </div>
        </div>

        <div class="flex gap-2 justify-end pt-2">
          <Button inline rounded raised onClick={nextStep}>
            {$i18n.t("ui:buttons:continue")}
          </Button>
        </div>
      </div>
    {/if}

    {#if activeStep === 2}
      <div class="space-y-4">
        <div class="text-center space-y-2">
          <GPSIcon className="size-14 ml-auto mr-auto" />
          <h3 class="text-lg font-semibold">{$i18n.t("ui:dialog:onboarding:step2Info")}</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            {$i18n.t("ui:dialog:onboarding:step2Msg")}
          </p>
        </div>

        <div class="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3">
          <p class="text-xs text-blue-800 dark:text-blue-200">
            {$i18n.t("ui:dialog:onboarding:step2Warning")}
          </p>
        </div>

        {#if permissionStatus === "denied"}
          <div class="bg-orange-50 dark:bg-orange-900/30 rounded-lg p-3">
            <p class="text-xs text-orange-800 dark:text-orange-200">
              {$i18n.t("ui:dialog:onboarding:step2Alert")}
            </p>
          </div>
        {/if}

        <div class="flex gap-2 justify-between pt-2">
          <Button inline rounded onClick={prevStep}>
            {$i18n.t("ui:buttons:back")}
          </Button>

          <div class="flex gap-2">
            <Button inline rounded onClick={completeOnboarding}>
              {$i18n.t("ui:buttons:skip")}
            </Button>
            <Button inline rounded raised onClick={requestLocationPermission} disabled={isRequestingPermission}>
              {isRequestingPermission ? $i18n.t("ui:buttons:waiting") : $i18n.t("ui:buttons:allow")}
            </Button>
          </div>
        </div>
      </div>
    {/if}
  </Block>
</Dialog>
