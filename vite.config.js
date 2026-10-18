import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

import { URL, fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

// Read package.json file
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const capConfig = JSON.parse(readFileSync('./capacitor.config.json', 'utf-8'));

// https://vite.dev/config/
export default defineConfig({
  define: {
    // global variables:
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_NAME__: JSON.stringify(capConfig.appName),
  },
  base: '', // or './'
  plugins: [svelte(), tailwindcss()],
  server: {
    watch: {
      usePolling: true,
    },
  },
  css: {
    devSourcemap: true,
    scss: {
      api: 'modern-compiler',
    },
  },
  build: {
    minify: true,
    copyPublicDir: true,
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: true,
    reportCompressedSize: true,
    rollupOptions: {
      watch: {
        clearScreen: false,
      },
    },
  },

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
