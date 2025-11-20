import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
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
    minify: false,
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
