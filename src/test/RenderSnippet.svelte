<script>
  /**
   * Test-only host for a snippet a screen hands to shared chrome (navbar/panel profiles), so a
   * test can render and click it: mount(RenderSnippet, { target, props: { snippet } }).
   */
  let { snippet } = $props();
</script>

{#if snippet}
  {@render snippet()}
{/if}
