import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [tailwindcss(), svelte()],
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
    copyPublicDir: false,
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
});
