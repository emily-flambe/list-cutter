import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  build: {
    manifest: true,
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          mui: ['@mui/material', '@mui/icons-material'],
          router: ['react-router-dom'],
          utils: ['axios']
        }
      }
    }
  },
  publicDir: "public",
  plugins: [
    react()
  ],
  optimizeDeps: {
    include: ['react-archer']
  },
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
        target: 'https://cutty-api.emily-cogsdill.workers.dev',
        changeOrigin: true,
        secure: true,
      }
    }
  }
})
