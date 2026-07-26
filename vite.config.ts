import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@tiptap/y-tiptap': path.resolve(__dirname, 'node_modules/@tiptap/y-tiptap/dist/y-tiptap.js'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:1234',
        changeOrigin: true,
      }
    }
  }
})
