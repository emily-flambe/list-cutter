import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.NODE_ENV === 'production' 
    ? 'https://list-cutter.emilyflam.be/'
    : '/',
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
  plugins: [react()],
})
