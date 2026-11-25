import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const nodeEnv = (
  globalThis as { process?: { env?: Record<string, string | undefined> } }
).process?.env;
const basePath = nodeEnv?.VITE_BASE_PATH || '/';

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'icons/apple-touch-icon.png',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-maskable-512.png',
        'draco/draco_decoder.wasm',
        'draco/draco_wasm_wrapper.js',
        'draco/draco_decoder.js',
        'models/*.glb',
      ],
      manifest: {
        name: 'Bizim Mutfak — 2 Kişilik 3D Mutfak',
        short_name: 'Bizim Mutfak',
        description: '2 kişilik (ve tek kişilik) izometrik 3D Web/PWA mutfak oyunu',
        lang: 'tr',
        theme_color: '#1e1b18',
        background_color: '#1e1b18',
        display: 'standalone',
        orientation: 'landscape',
        scope: basePath,
        start_url: basePath,
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm,glb}'],
        maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
        runtimeCaching: [
          {
            // All Supabase REST, Auth, and Realtime endpoints MUST stay NetworkOnly
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^wss:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'three-vendor': ['three', '@react-three/fiber', '@react-three/drei'],
          'supabase-vendor': ['@supabase/supabase-js'],
        },
      },
    },
  },
});
