<div class="app-splash-screen">
  <img class="app-logo" src="/icon.svg" alt="App logo" />
  <h1 class="app-name">Polskie Ślady Taszkent</h1>
  <p class="app-version">Version: 1.0.0</p>
</div>

<style>
  .app-splash-screen {
    width: 100%;
    height: 100dvh;

    display: flex;
    flex-direction: column;

    align-items: center;
    justify-content: center;
  }

  .app-logo {
    width: 120px;
    height: 120px;

    object-fit: contain;

    display: flex;
    flex: 0 0 auto;
  }

  .app-name {
    font-size: 36px;
    font-weight: 600;

    line-height: 1.2;

    display: block;

    margin: 22px 0 4px;

    color: #fc3431;
  }

  .app-version {
    font-size: 14px;
    font-weight: 400;

    line-height: 1.2;

    color: #7c7c7c;
  }
</style>
