import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:5000',
      '/scan': 'http://127.0.0.1:5000',
      '/jobs': 'http://127.0.0.1:5000',
      '/snapshots': 'http://127.0.0.1:5000',
      '/drift': 'http://127.0.0.1:5000',
      '/baseline': 'http://127.0.0.1:5000',
      '/deep-check': 'http://127.0.0.1:5000'
    }
  }
})
