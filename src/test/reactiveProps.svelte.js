/**
 * Test-only: reactive props for a mounted component, so a test can change a prop the way a parent
 * would. Runes only work in .svelte(.js) files, hence this tiny module.
 *
 * Usage:
 *   const props = reactiveProps({ path: 'photos/a/1.jpg' });
 *   const component = mount(PhotoThumb, { target, props });
 *   props.path = 'photos/a/2.jpg';
 *   flushSync();
 */
export function reactiveProps(initial) {
  const props = $state(initial);
  return props;
}
