import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL || 'https://multi-channel.imfinethankyouandyou.com',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    target: 'es2022',
    minify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router'],
          'pinia-vendor': ['pinia']
        }
      }
    }
  }
})