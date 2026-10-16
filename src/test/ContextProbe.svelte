<script module>
  /** What the last mounted probe read from the context (test-only) */
  export const captured = { value: undefined };
</script>

<script>
  /**
   * Test-only stand-in for a child (e.g. the Router) that reads one context value, so a test can
   * check what a parent puts into the context: `captured.value` after mounting the parent.
   */
  import { getContext } from "svelte";

  let { contextKey = "appScroll" } = $props();

  // svelte-ignore state_referenced_locally
  captured.value = getContext(contextKey);
</script>
