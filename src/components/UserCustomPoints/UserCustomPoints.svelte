<script>
  import { Page } from "konsta/svelte";

  let { i18n } = $props();
</script>

<section class="user-custom-points">
  <Page>
    <h1>{$i18n.t("ui:map:userCustomPoints:message")}</h1>
    <p>{$i18n.t("ui:map:userCustomPoints:instruction")}</p>
  </Page>
</section>

<style>
  .user-custom-points {
    display: flex;
    flex-direction: column;

    justify-content: center;

    gap: 14px;
    padding: 8px;

    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
  }
</style>
