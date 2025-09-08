import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { visualizer } from 'rollup-plugin-visualizer'
import viteCompression from 'vite-plugin-compression'

export default defineConfig(() => {
  // Development environment is handled by the configuration below
  
  return {
  plugins: [
    vue(),
    // Gzip compression for production
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz'
    }),
    // Brotli compression for production
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br'
    }),
    // Bundle analyzer (only in build mode)
    process.env.ANALYZE && visualizer({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@shared': resolve(__dirname, '../shared'),
      '@composables': resolve(__dirname, 'src/composables'),
      '@components': resolve(__dirname, 'src/components'),
      '@views': resolve(__dirname, 'src/views'),
      '@stores': resolve(__dirname, 'src/stores'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@api': resolve(__dirname, 'src/api')
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL || 'http://localhost:8787',
        changeOrigin: true,
        secure: false, // 本地開發時設為 false，遠程時設為 true
        rewrite: (path) => path, // 保持路徑不變
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      }
    }
  },
  build: {
    // 現代化構建配置
    target: 'es2022',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: true,
        pure_funcs: process.env.NODE_ENV === 'production' ? ['console.log'] : [],
        passes: 2 // 多次壓縮以獲得更好的結果
      },
      format: {
        comments: false
      },
      mangle: {
        safari10: true // 支援 Safari 10
      }
    },
    // Chunk splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'vue-vendor': ['vue', 'vue-router'],
          'pinia-vendor': ['pinia'],
          
          // Feature chunks
          'conversation': [
            './src/views/ConversationList.vue',
            './src/views/ConversationDetail.vue',
            './src/components/conversation/ConversationCard.vue',
            './src/components/conversation/MessageBubble.vue'
          ],
          'dashboard': ['./src/views/Dashboard.vue'],
          'auth': ['./src/views/Login.vue', './src/stores/auth.ts'],
          'composables': [
            './src/composables/useAuth.ts',
            './src/composables/useConversations.ts',
            './src/composables/useMessages.ts',
            './src/composables/useModernVue.ts'
          ],
          

          
          // Mock data (only in development)
          ...(process.env.NODE_ENV === 'development' ? {
            'mock-data': ['./src/utils/mockData.ts']
          } : {})
        },
        // Optimize chunk file names
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId
          if (facadeModuleId) {
            const name = facadeModuleId.split('/').pop()?.replace('.vue', '') || 'chunk'
            return `assets/${name}-[hash].js`
          }
          return 'assets/[name]-[hash].js'
        }
      }
    },
    // Optimize asset handling
    assetsInlineLimit: 4096, // Inline assets smaller than 4kb
    cssCodeSplit: true, // Split CSS into separate files
    sourcemap: false // Disable sourcemaps in production
  },
  // Enable compression in development for testing
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : ['debugger']
  }
  }
})