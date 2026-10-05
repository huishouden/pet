import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { pwaApp } from '@huishouden/pwa-kit/vite';

const googleFontsCache = (urlPattern: RegExp, cacheName: string) => ({
  urlPattern,
  handler: 'CacheFirst' as const,
  options: {
    cacheName,
    expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
    cacheableResponse: { statuses: [0, 200] },
  },
});

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    pwaApp({
      // Pet's path on the suite's one site (pwa-kit docs/one-site.md).
      base: '/pet/',
      name: 'Huishouden Pet',
      shortName: 'Pet',
      description: 'Looking after the pets, together',
      push: true,
      ocr: true,
      // Google Maps places and contact cards from the Share menu (Android, installed).
      shareTarget: { contacts: true, images: true },
      themeColor: '#1b4332',
      backgroundColor: '#faf9f5',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'og.png'],
      overrides: {
        manifest: { categories: ['lifestyle', 'productivity'] },
        workbox: {
          runtimeCaching: [
            googleFontsCache(/^https:\/\/fonts\.googleapis\.com\/.*/i, 'google-fonts-cache'),
            googleFontsCache(/^https:\/\/fonts\.gstatic\.com\/.*/i, 'gstatic-fonts-cache'),
          ],
        },
      },
    }),
  ],
});
