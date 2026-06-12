import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Split recharts and its d3 dependencies into their own vendor
        // chunk to keep the main bundle under the 500 kB warning limit.
        manualChunks: (id) => {
          if (
            id.includes('node_modules/recharts') ||
            id.includes('node_modules/victory-vendor') ||
            id.includes('node_modules/d3-')
          ) {
            return 'recharts-vendor'
          }
        },
      },
    },
  },
})
