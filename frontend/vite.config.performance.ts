import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { visualizer } from 'rollup-plugin-visualizer'
import viteCompression from 'vite-plugin-compression'

// Performance-focused Vite configuration
export default defineConfig({
  plugins: [
    vue({
      // Enable script setup sugar
      script: {
        defineModel: true,
        propsDestructure: true
      },
      // Template compilation optimizations
      template: {
        compilerOptions: {
          // Remove comments in production
          comments: process.env.NODE_ENV !== 'production'
        }
      }
    }),
    
    // Compression plugins
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 1024, // Only compress files larger than 1KB
      deleteOriginFile: false
    }),
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 1024
    }),
    
    // Bundle analyzer
    process.env.ANALYZE && visualizer({
      filename: 'dist/bundle-analysis.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
      template: 'treemap' // or 'sunburst', 'network'
    })
  ].filter(Boolean),

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@shared': resolve(__dirname, '../shared')
    }
  },

  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        secure: false
      }
    },
    // Enable HMR optimizations
    hmr: {
      overlay: true
    }
  },

  build: {
    // Target modern browsers for better performance
    target: 'es2020',
    
    // Minification settings
    minify: 'terser',
    terserOptions: {
      /* eslint-disable camelcase */
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug']
      /* eslint-enable camelcase */
      },
      mangle: {
        safari10: true
      }
    },

    // Chunk splitting strategy
    rollupOptions: {
      output: {
        // Optimize chunk splitting
        manualChunks: (id) => {
          // Vendor chunks
          if (id.includes('node_modules')) {
            if (id.includes('vue') || id.includes('@vue')) {
              return 'vue-vendor'
            }
            if (id.includes('pinia')) {
              return 'pinia-vendor'
            }
            if (id.includes('date-fns')) {
              return 'date-vendor'
            }
            return 'vendor'
          }
          
          // Feature-based chunks
          if (id.includes('/views/')) {
            const viewName = id.split('/views/')[1]?.split('.')[0]
            return `view-${viewName?.toLowerCase()}`
          }
          
          if (id.includes('/components/')) {
            return 'components'
          }
          
          if (id.includes('/stores/')) {
            return 'stores'
          }
          
          if (id.includes('/utils/')) {
            return 'utils'
          }
        },
        
        // Optimize file names
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },

    // Asset optimization
    assetsInlineLimit: 4096, // 4KB threshold
    cssCodeSplit: true,
    sourcemap: false, // Disable in production for performance
    
    // Optimize CSS
    cssMinify: true,
    
    // Report compressed file sizes
    reportCompressedSize: true,
    
    // Chunk size warning limit
    chunkSizeWarningLimit: 1000
  },

  // Optimize dependencies
  optimizeDeps: {
    include: [
      'vue',
      'vue-router',
      'pinia',
      '@vueuse/core',
      'date-fns'
    ],
    exclude: ['@vue/devtools-api']
  },

  // Enable esbuild optimizations
  esbuild: {
    target: 'es2020',
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : []
  }
})