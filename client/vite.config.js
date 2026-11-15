import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5176,
  },
  build: {
    rollupOptions: {
      output: {
        // Long-lived vendor chunks: app updates don't force users to re-download React/Clerk
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\/]node_modules[\/]@clerk[\/]/.test(id)) return 'clerk';
          if (/[\/]node_modules[\/](react|react-dom|react-router|react-router-dom|scheduler)[\/]/.test(id)) return 'react';
          return 'vendor';
        },
      },
    },
  },
})
