import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  build: {
    manifest: true,
    outDir: "dist",
  },
  publicDir: "public",
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    hmr: {
      host: 'localhost'
    },
    watch: {
      usePolling: true,
    },
    proxy: {
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
