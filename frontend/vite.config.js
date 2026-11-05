import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    proxy: {
      '/api/bot': {
        target: 'http://127.0.0.1:3001',
        ws: true,
      },
      '/api/library': {
        target: 'http://127.0.0.1:3002',
      },
    },
  },
})
