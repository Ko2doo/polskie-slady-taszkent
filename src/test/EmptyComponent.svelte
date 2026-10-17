<script>
  /**
   * Test-only stand-in for a heavy child component (vi.mock(path, () => ({ default: EmptyComponent }))),
   * when a test is about the parent's own wiring and the child is covered by its own tests.
   */
  let { ...props } = $props();
</script>

<div data-empty-component data-props={Object.keys(props).join(",")}></div>
