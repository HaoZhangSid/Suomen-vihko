import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      devOptions: {
        enabled: true
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,wav}']
      },
      manifest: {
        name: 'Suomen Vihko',
        short_name: 'SuomenVihko',
        description: 'Finnish language learning notes app.',
        theme_color: '#ffffff',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ],
        display: 'standalone',
        start_url: '.',
        scope: '.',
        background_color: '#ffffff'
      }
    })
  ],
  base: '/',
  server: {
    host: true
  }
})
