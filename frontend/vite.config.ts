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
        '@': resolve(__dirname, 'src'),
        '@shared': resolve(__dirname, '../shared')
      }
    },
    server: {
      port: parseInt(env.VITE_PORT || '5173'), // Use env var or default to 5173 (avoids Windows reserved range 2904-3003)
      proxy: {
        '/api': {
          target: apiBaseUrl,
          changeOrigin: true,
          secure: true,
          ws: true,
          rewriteWsOrigin: true
        }
      }
    },
    build: {
      target: 'es2022',
      minify: true,
      modulePreload: { polyfill: false },
      rolldownOptions: {
        output: {
          // vite 8 bundles with rolldown, which dropped the object form of
          // manualChunks. codeSplitting.groups is the replacement; `test`
          // matches module ids, so @vue/* has to be listed explicitly to keep
          // vue's runtime in the same chunk as before.
          codeSplitting: {
            groups: [
              { name: 'vue-vendor', test: /node_modules[\\/](?:@vue[\\/]|vue[\\/]|vue-router[\\/])/ },
              { name: 'pinia-vendor', test: /node_modules[\\/]pinia[\\/]/ }
            ]
          }
        }
      }
    }
  }
})
