import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cloudflareDevProxyVitePlugin } from '@cloudflare/vite-plugin'

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
    react(),
    cloudflareDevProxyVitePlugin({
      proxyOptions: {
        '/api': {
          target: 'http://0.0.0.0:8000',
          changeOrigin: true,
          secure: false,
        }
      }
    })
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
    }
  }
})
