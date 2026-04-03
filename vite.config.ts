import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backendUrl = 'https://foxwj-154-68-72-126.run.pinggy-free.link';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
