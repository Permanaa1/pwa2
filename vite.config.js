import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      manifest: {
        name: 'Bore & Barrel',
        short_name: 'Bore & Barrel',
        description: 'A small armory — pistols, rifles, and shotguns.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f2f4f5',
        theme_color: '#f2f4f5',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,webp,webmanifest}'],
        runtimeCaching: [
          {
            // Caching untuk gambar (lokal maupun eksternal/Supabase Storage)
            urlPattern: ({ request, url }) =>
              request.destination === 'image' ||
              /\.(?:png|jpg|jpeg|svg|gif|webp)$/i.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'armory-images-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 30 * 24 * 60 * 60, // Simpan 30 hari
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Caching untuk query data REST API (Supabase / Backend)
            urlPattern: ({ url }) =>
              url.origin.includes('supabase.co') || url.pathname.includes('/rest/v1/'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'armory-api-query-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 5 * 60, // Simpan 5 menit
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
})