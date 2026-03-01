import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/icon-192.svg', 'icons/icon-512.svg'],
      manifest: false, // Use static manifest.json from public/
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        runtimeCaching: [
          {
            // Pay/BAH table API — cache-first, 7-day expiry
            urlPattern: /\/api\/tables\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'pay-tables',
              expiration: { maxEntries: 20, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Auth + snapshot API — network only, never cache
            urlPattern: /\/api\/(auth|store)\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  worker: {
    format: 'es',
  },
  resolve: {
    alias: {
      '@fortress/types': path.resolve(__dirname, '../packages/types/src'),
      '@pay-tables': path.resolve(__dirname, '../data/pay-tables'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
});
