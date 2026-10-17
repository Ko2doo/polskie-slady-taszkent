<script>
  import { fly } from "svelte/transition";
  import { hideTabbar } from "@/lib/state/bottomTabbarNav.svelte";

  let { i18n, appName = "", version = "", appLogo } = $props();

  // No tab bar behind the splash; it slides in (slowly, as the app's entrance) once the splash goes
  $effect(() => hideTabbar({ duration: 400, delay: 350 }));
</script>

<article class="app-splash-screen" out:fly={{ duration: 500, y: 20, delay: 200 }}>
  <div class="app-logo-wrapper">
    <img class="app-logo" src={appLogo} alt={$i18n.t("ui:splash:logoAlt")} />
    <h1 class="app-name">
      {appName}
    </h1>
  </div>
  <p class="app-version">{$i18n.t("ui:splash:version", { version })}</p>
</article>

<style>
  .app-splash-screen {
    width: 100%;
    height: 100dvh;

    padding: 44px 18px;

    position: relative;
    z-index: 60;

    display: flex;
    flex-direction: column;

    align-items: center;
  }

  .app-logo-wrapper {
    display: flex;
    flex-direction: column;

    align-items: center;

    margin-top: 20%;
  }

  .app-logo {
    width: 86px;
    height: 86px;

    object-fit: contain;

    display: flex;
    flex: 0 0 auto;
  }

  .app-name {
    font-size: 32px;
    font-weight: 600;

    line-height: 1.2;

    width: 80%;
    padding-left: 18px;
    padding-right: 18px;

    display: block;
    text-align: center;

    margin-top: 22px;

    color: #fc3431;
  }

  .app-version {
    font-size: 14px;
    font-weight: 200;

    display: block;
    margin-top: auto;

    line-height: 1.2;

    color: #7e7e7e;
  }
</style>
