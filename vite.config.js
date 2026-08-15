import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'pwa-icon.png'],
      manifest: {
        name: 'WATER LEVEL MONITORING SYSTEM WITH ESP32',
        // short_name คือชื่อใต้ไอคอนตอนติดตั้งเป็นแอป ต้องสั้น ไม่งั้นถูกตัดกลางคำ
        short_name: 'Water Level',
        description: 'ระบบตรวจวัดระดับน้ำ เพื่อการบริหารจัดการแปลงนาเกลือ ด้วย ESP32',
        theme_color: '#3b82f6',
        background_color: '#f9fafb',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'pwa-icon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-icon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        importScripts: ['sw-push.js'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/evwfgksoitfjdigrvdbd\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['aquasense-7loa.onrender.com'],
  },
  preview: {
    host: true,
    port: 10000,
    allowedHosts: ['aquasense-7loa.onrender.com'],
  },
})
