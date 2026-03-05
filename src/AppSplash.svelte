<script>
  import { fly } from "svelte/transition";

  let { version } = $props();
</script>

<article class="app-splash-screen" out:fly={{ duration: 120, y: 20 }}>
  <img class="app-logo" src="/icon.svg" alt="App logo" />
  <h1 class="app-name">Polskie Ślady <br /> Taszkent</h1>
  <p class="app-version">Version: {version}</p>
</article>

<style>
  .app-splash-screen {
    width: 100%;
    height: 100dvh;

    padding: 0 18px;

    display: flex;
    flex-direction: column;

    align-items: center;
    justify-content: center;

    background: linear-gradient(180deg, #f05e64, #ffc8c8);
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

    margin: 14px 0 2px;

    color: #fc3431;
  }

  .app-version {
    font-size: 14px;
    font-weight: 200;

    line-height: 1.2;

    color: #fbf5f5;
  }
</style>
