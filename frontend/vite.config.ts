import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// Use function syntax to access environment variables
export default defineConfig(({ mode }) => {
  // Load env file based on mode (development, production)
  const env = loadEnv(mode, process.cwd(), '')

  // Default to remote backend for this project (remote-only strategy)
  const apiBaseUrl = env.VITE_API_BASE_URL || env.VITE_BACKEND_URL || 'https://mcis-backend.daiwandist.com'

  console.log(`[vite.config] Proxy target: ${apiBaseUrl}`)

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },
    server: {
      port: parseInt(env.VITE_PORT || '5173'), // Use env var or default to 5173 (avoids Windows reserved range 2904-3003)
      proxy: {
        '/api': {
          target: apiBaseUrl,
          changeOrigin: true,
          secure: true
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
  }
})