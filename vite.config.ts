/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { PWA_MANIFEST } from './src/app/pwa';

export default defineConfig({
  // Relative, so a build runs from any path: a Netlify root, a GitHub Pages
  // project subpath, or a file server. See README.
  base: './',
  build: {
    target: 'es2020',
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: PWA_MANIFEST,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        // The whole app shell is precached; nothing is fetched at runtime.
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
