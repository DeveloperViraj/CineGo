import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// Note: no custom manualChunks. Splitting node_modules into separate "react" and
// "vendor" chunks created a circular import between them, so in production the
// vendor chunk could run before React existed and the page rendered blank.
// Vite's default splitting (plus the lazy-loaded routes in App.jsx) is safe.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5176,
  },
})
