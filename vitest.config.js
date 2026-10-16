import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.js';

// Reuses vite.config.js as-is, so tests see the same `@` alias, the same Svelte/Tailwind
// plugins and the same `__APP_VERSION__`/`__APP_NAME__` globals as the app build.
export default mergeConfig(
  viteConfig,
  defineConfig({
    // Resolve `svelte` to its client build: `mount()` throws under the default server build.
    resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.js'],
      setupFiles: ['src/test/setup.js'],
      restoreMocks: true,
      unstubGlobals: true,
      unstubEnvs: true,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{js,svelte}'],
        exclude: ['src/**/*.test.js', 'src/test/**', 'src/locales/**', 'src/lib/icons/**'],
        reporter: ['text-summary', 'html'],
      },
    },
  }),
);
