import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

import path from 'node:path';
import { readFileSync } from 'node:fs';

// Read package.json file
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

// https://vite.dev/config/
export default defineConfig({
  define: {
    // global variables:
    __APP_VERSION__: JSON.stringify(pkg.version),
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
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
});
