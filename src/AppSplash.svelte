<script>
  import { fly } from "svelte/transition";

  let { version = "" } = $props();
</script>

<article class="app-splash-screen" out:fly={{ duration: 300, y: 20, delay: 120 }}>
  <div class="app-logo-wrapper">
    <img class="app-logo" src="app-icon.png" alt="App logo" />
    <h1 class="app-name">Polskie Ślady <br /> Taszkent</h1>
  </div>
  <p class="app-version">Version: {version}</p>
</article>

<style>
  .app-splash-screen {
    width: 100%;
    height: 100dvh;

    padding: 44px 18px;

    display: flex;
    flex-direction: column;

    align-items: center;
    justify-content: space-around;
  }

  .app-logo-wrapper {
    display: flex;
    flex-direction: column;

    align-items: center;
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

    display: block;
    text-align: center;

    margin-top: 14px;

    color: #fc3431;
  }

  .app-version {
    font-size: 14px;
    font-weight: 200;

    line-height: 1.2;

    color: #6f6a6a;
  }
</style>
