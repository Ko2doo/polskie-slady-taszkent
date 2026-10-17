import colors from 'tailwindcss/colors';

/**
 * Tailwind 4 JS config, loaded from `src/App.css` via `@config`.
 *
 * `black`/`white` are remapped to soft stone shades for the whole app: every
 * `bg-black`, `text-white/15`, etc. and Konsta's `--k-color-*` (see App.css) use them.
 * Values must be literal colors, not `var(...)`: Tailwind inlines JS-config colors into the
 * utilities (`bg-black/50` → `oklab(... / .5)`) and emits no `--color-black` variable, so
 * a var() here would point at nothing. Plain CSS reads these via `--theme(--color-black)`.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  theme: {
    extend: {
      colors: {
        black: colors.stone[800],
        white: colors.stone[100],
      },
    },
  },
};
