/**
 * Test-only: the smallest i18n store a component's `$i18n.t(...)` needs (see harness/testing.md).
 * `t` returns the key, plus the interpolation values when given, so assertions can check exactly
 * which key and values were rendered.
 */
export const i18nStub = {
  subscribe(listener) {
    listener({
      t: (key, values) => (values ? `${key} ${JSON.stringify(values)}` : key),
      language: 'en',
    });
    return () => {};
  },
};
