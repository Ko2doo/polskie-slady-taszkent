<script>
  import Close from "@/lib/icons/Close.svelte";
  import SPLogo from "@/lib/icons/SPLogo.svelte";
  import { Block, Link, Navbar, Page, Popup } from "konsta/svelte";

  let { i18n, popupToggler } = $props();
</script>

<Popup opened={popupToggler.value} backdrop={true}>
  <Page>
    <Navbar title={$i18n.t("ui:settings:about:popupTitle")}>
      {#snippet right()}
        <Link iconOnly onClick={() => popupToggler.close()}><Close /></Link>
      {/snippet}
    </Navbar>

    <Block strong inset>
      <div class="logo-wrapper flex justify-center">
        <SPLogo />
      </div>
    </Block>
  </Page>
</Popup>
