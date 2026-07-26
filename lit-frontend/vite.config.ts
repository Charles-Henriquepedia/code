import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
  server: {
    port: 5173,
    proxy: {
      '/api/v1': {
        target: 'http://localhost:18773',
        ws: true,
      },
      '/api': {
        target: 'http://localhost:18773',
        ws: true,
      },
    },
  },
})
