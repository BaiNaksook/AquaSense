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
        name: 'SaltSense — Smart Salt Farm Water Level & Salinity Monitoring System',
        // short_name คือชื่อใต้ไอคอนตอนติดตั้งเป็นแอป ต้องสั้น ไม่งั้นถูกตัดกลางคำ
        short_name: 'SaltSense',
        description: 'ระบบตรวจวัดระดับน้ำและความเค็ม เพื่อการบริหารจัดการนาเกลือ ด้วย ESP32',
        theme_color: '#f4f4f1',
        background_color: '#f4f4f1',
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
        // รวมไฟล์เสียงพูด (public/voice) เพื่อให้กดฟังเสียงได้แม้ไม่มีเน็ต
        globPatterns: ['**/*.{js,css,html,svg,png,ico,mp3}', 'voice/manifest.json'],
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
