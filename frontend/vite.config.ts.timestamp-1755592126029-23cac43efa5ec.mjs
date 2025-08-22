// vite.config.ts
import { defineConfig } from "file:///D:/Code/Multi_Channel_Integration_System/frontend/node_modules/vite/dist/node/index.js";
import vue from "file:///D:/Code/Multi_Channel_Integration_System/frontend/node_modules/@vitejs/plugin-vue/dist/index.mjs";
import { resolve } from "path";
import { visualizer } from "file:///D:/Code/Multi_Channel_Integration_System/frontend/node_modules/rollup-plugin-visualizer/dist/plugin/index.js";
import viteCompression from "file:///D:/Code/Multi_Channel_Integration_System/frontend/node_modules/vite-plugin-compression/dist/index.mjs";
const __vite_injected_original_dirname = "D:\\Code\\Multi_Channel_Integration_System\\frontend";
const vite_config_default = defineConfig({
  plugins: [
    vue(),
    // Gzip compression for production
    viteCompression({
      algorithm: "gzip",
      ext: ".gz"
    }),
    // Brotli compression for production
    viteCompression({
      algorithm: "brotliCompress",
      ext: ".br"
    }),
    // Bundle analyzer (only in build mode)
    process.env.ANALYZE && visualizer({
      filename: "dist/stats.html",
      open: true,
      gzipSize: true,
      brotliSize: true
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": resolve(__vite_injected_original_dirname, "src"),
      "@shared": resolve(__vite_injected_original_dirname, "../shared"),
      "@composables": resolve(__vite_injected_original_dirname, "src/composables"),
      "@components": resolve(__vite_injected_original_dirname, "src/components"),
      "@views": resolve(__vite_injected_original_dirname, "src/views"),
      "@stores": resolve(__vite_injected_original_dirname, "src/stores"),
      "@utils": resolve(__vite_injected_original_dirname, "src/utils"),
      "@api": resolve(__vite_injected_original_dirname, "src/api")
    }
  },
  server: {
    port: 3e3,
    proxy: {
      "/api": {
        target: process.env.VITE_API_BASE_URL || "http://localhost:8787",
        changeOrigin: true,
        secure: false,
        // 本地開發時設為 false，遠程時設為 true
        rewrite: (path) => path,
        // 保持路徑不變
        configure: (proxy, _options) => {
          proxy.on("error", (err, _req, _res) => {
            console.log("proxy error", err);
          });
          proxy.on("proxyReq", (proxyReq, req, _res) => {
            console.log("Sending Request to the Target:", req.method, req.url);
          });
          proxy.on("proxyRes", (proxyRes, req, _res) => {
            console.log("Received Response from the Target:", proxyRes.statusCode, req.url);
          });
        }
      }
    }
  },
  build: {
    // 現代化構建配置
    target: "es2022",
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === "production",
        drop_debugger: true,
        pure_funcs: process.env.NODE_ENV === "production" ? ["console.log"] : [],
        passes: 2
        // 多次壓縮以獲得更好的結果
      },
      format: {
        comments: false
      },
      mangle: {
        safari10: true
        // 支援 Safari 10
      }
    },
    // Chunk splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          "vue-vendor": ["vue", "vue-router"],
          "pinia-vendor": ["pinia"],
          // Feature chunks
          "conversation": [
            "./src/views/ConversationList.vue",
            "./src/views/ConversationDetail.vue",
            "./src/components/conversation/ConversationCard.vue",
            "./src/components/conversation/MessageBubble.vue"
          ],
          "dashboard": ["./src/views/Dashboard.vue"],
          "auth": ["./src/views/Login.vue", "./src/stores/auth.ts"],
          "composables": [
            "./src/composables/useAuth.ts",
            "./src/composables/useConversations.ts",
            "./src/composables/useMessages.ts",
            "./src/composables/useModernVue.ts"
          ],
          // Mock data (only in development)
          ...process.env.NODE_ENV === "development" ? {
            "mock-data": ["./src/utils/mockData.ts"]
          } : {}
        },
        // Optimize chunk file names
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId;
          if (facadeModuleId) {
            const name = facadeModuleId.split("/").pop()?.replace(".vue", "") || "chunk";
            return `assets/${name}-[hash].js`;
          }
          return "assets/[name]-[hash].js";
        }
      }
    },
    // Optimize asset handling
    assetsInlineLimit: 4096,
    // Inline assets smaller than 4kb
    cssCodeSplit: true,
    // Split CSS into separate files
    sourcemap: false
    // Disable sourcemaps in production
  },
  // Enable compression in development for testing
  esbuild: {
    drop: process.env.NODE_ENV === "production" ? ["console", "debugger"] : ["debugger"]
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxDb2RlXFxcXE11bHRpX0NoYW5uZWxfSW50ZWdyYXRpb25fU3lzdGVtXFxcXGZyb250ZW5kXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJEOlxcXFxDb2RlXFxcXE11bHRpX0NoYW5uZWxfSW50ZWdyYXRpb25fU3lzdGVtXFxcXGZyb250ZW5kXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9EOi9Db2RlL011bHRpX0NoYW5uZWxfSW50ZWdyYXRpb25fU3lzdGVtL2Zyb250ZW5kL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IHZ1ZSBmcm9tICdAdml0ZWpzL3BsdWdpbi12dWUnXHJcbmltcG9ydCB7IHJlc29sdmUgfSBmcm9tICdwYXRoJ1xyXG5pbXBvcnQgeyB2aXN1YWxpemVyIH0gZnJvbSAncm9sbHVwLXBsdWdpbi12aXN1YWxpemVyJ1xyXG5pbXBvcnQgdml0ZUNvbXByZXNzaW9uIGZyb20gJ3ZpdGUtcGx1Z2luLWNvbXByZXNzaW9uJ1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICBwbHVnaW5zOiBbXHJcbiAgICB2dWUoKSxcclxuICAgIC8vIEd6aXAgY29tcHJlc3Npb24gZm9yIHByb2R1Y3Rpb25cclxuICAgIHZpdGVDb21wcmVzc2lvbih7XHJcbiAgICAgIGFsZ29yaXRobTogJ2d6aXAnLFxyXG4gICAgICBleHQ6ICcuZ3onXHJcbiAgICB9KSxcclxuICAgIC8vIEJyb3RsaSBjb21wcmVzc2lvbiBmb3IgcHJvZHVjdGlvblxyXG4gICAgdml0ZUNvbXByZXNzaW9uKHtcclxuICAgICAgYWxnb3JpdGhtOiAnYnJvdGxpQ29tcHJlc3MnLFxyXG4gICAgICBleHQ6ICcuYnInXHJcbiAgICB9KSxcclxuICAgIC8vIEJ1bmRsZSBhbmFseXplciAob25seSBpbiBidWlsZCBtb2RlKVxyXG4gICAgcHJvY2Vzcy5lbnYuQU5BTFlaRSAmJiB2aXN1YWxpemVyKHtcclxuICAgICAgZmlsZW5hbWU6ICdkaXN0L3N0YXRzLmh0bWwnLFxyXG4gICAgICBvcGVuOiB0cnVlLFxyXG4gICAgICBnemlwU2l6ZTogdHJ1ZSxcclxuICAgICAgYnJvdGxpU2l6ZTogdHJ1ZVxyXG4gICAgfSlcclxuICBdLmZpbHRlcihCb29sZWFuKSxcclxuICByZXNvbHZlOiB7XHJcbiAgICBhbGlhczoge1xyXG4gICAgICAnQCc6IHJlc29sdmUoX19kaXJuYW1lLCAnc3JjJyksXHJcbiAgICAgICdAc2hhcmVkJzogcmVzb2x2ZShfX2Rpcm5hbWUsICcuLi9zaGFyZWQnKSxcclxuICAgICAgJ0Bjb21wb3NhYmxlcyc6IHJlc29sdmUoX19kaXJuYW1lLCAnc3JjL2NvbXBvc2FibGVzJyksXHJcbiAgICAgICdAY29tcG9uZW50cyc6IHJlc29sdmUoX19kaXJuYW1lLCAnc3JjL2NvbXBvbmVudHMnKSxcclxuICAgICAgJ0B2aWV3cyc6IHJlc29sdmUoX19kaXJuYW1lLCAnc3JjL3ZpZXdzJyksXHJcbiAgICAgICdAc3RvcmVzJzogcmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMvc3RvcmVzJyksXHJcbiAgICAgICdAdXRpbHMnOiByZXNvbHZlKF9fZGlybmFtZSwgJ3NyYy91dGlscycpLFxyXG4gICAgICAnQGFwaSc6IHJlc29sdmUoX19kaXJuYW1lLCAnc3JjL2FwaScpXHJcbiAgICB9XHJcbiAgfSxcclxuICBzZXJ2ZXI6IHtcclxuICAgIHBvcnQ6IDMwMDAsXHJcbiAgICBwcm94eToge1xyXG4gICAgICAnL2FwaSc6IHtcclxuICAgICAgICB0YXJnZXQ6IHByb2Nlc3MuZW52LlZJVEVfQVBJX0JBU0VfVVJMIHx8ICdodHRwOi8vbG9jYWxob3N0Ojg3ODcnLFxyXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgICBzZWN1cmU6IGZhbHNlLCAvLyBcdTY3MkNcdTU3MzBcdTk1OEJcdTc2N0NcdTY2NDJcdThBMkRcdTcwQkEgZmFsc2VcdUZGMENcdTkwNjBcdTdBMEJcdTY2NDJcdThBMkRcdTcwQkEgdHJ1ZVxyXG4gICAgICAgIHJld3JpdGU6IChwYXRoKSA9PiBwYXRoLCAvLyBcdTRGRERcdTYzMDFcdThERUZcdTVGOTFcdTRFMERcdThCOEFcclxuICAgICAgICBjb25maWd1cmU6IChwcm94eSwgX29wdGlvbnMpID0+IHtcclxuICAgICAgICAgIHByb3h5Lm9uKCdlcnJvcicsIChlcnIsIF9yZXEsIF9yZXMpID0+IHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ3Byb3h5IGVycm9yJywgZXJyKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgcHJveHkub24oJ3Byb3h5UmVxJywgKHByb3h5UmVxLCByZXEsIF9yZXMpID0+IHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ1NlbmRpbmcgUmVxdWVzdCB0byB0aGUgVGFyZ2V0OicsIHJlcS5tZXRob2QsIHJlcS51cmwpO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgICBwcm94eS5vbigncHJveHlSZXMnLCAocHJveHlSZXMsIHJlcSwgX3JlcykgPT4ge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnUmVjZWl2ZWQgUmVzcG9uc2UgZnJvbSB0aGUgVGFyZ2V0OicsIHByb3h5UmVzLnN0YXR1c0NvZGUsIHJlcS51cmwpO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfSxcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH0sXHJcbiAgYnVpbGQ6IHtcclxuICAgIC8vIFx1NzNGRVx1NEVFM1x1NTMxNlx1NjlDQlx1NUVGQVx1OTE0RFx1N0Y2RVxyXG4gICAgdGFyZ2V0OiAnZXMyMDIyJyxcclxuICAgIG1pbmlmeTogJ3RlcnNlcicsXHJcbiAgICB0ZXJzZXJPcHRpb25zOiB7XHJcbiAgICAgIGNvbXByZXNzOiB7XHJcbiAgICAgICAgZHJvcF9jb25zb2xlOiBwcm9jZXNzLmVudi5OT0RFX0VOViA9PT0gJ3Byb2R1Y3Rpb24nLFxyXG4gICAgICAgIGRyb3BfZGVidWdnZXI6IHRydWUsXHJcbiAgICAgICAgcHVyZV9mdW5jczogcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdwcm9kdWN0aW9uJyA/IFsnY29uc29sZS5sb2cnXSA6IFtdLFxyXG4gICAgICAgIHBhc3NlczogMiAvLyBcdTU5MUFcdTZCMjFcdTU4RDNcdTdFMkVcdTRFRTVcdTczNzJcdTVGOTdcdTY2RjRcdTU5N0RcdTc2ODRcdTdENTBcdTY3OUNcclxuICAgICAgfSxcclxuICAgICAgZm9ybWF0OiB7XHJcbiAgICAgICAgY29tbWVudHM6IGZhbHNlXHJcbiAgICAgIH0sXHJcbiAgICAgIG1hbmdsZToge1xyXG4gICAgICAgIHNhZmFyaTEwOiB0cnVlIC8vIFx1NjUyRlx1NjNGNCBTYWZhcmkgMTBcclxuICAgICAgfVxyXG4gICAgfSxcclxuICAgIC8vIENodW5rIHNwbGl0dGluZyBmb3IgYmV0dGVyIGNhY2hpbmdcclxuICAgIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgICAgb3V0cHV0OiB7XHJcbiAgICAgICAgbWFudWFsQ2h1bmtzOiB7XHJcbiAgICAgICAgICAvLyBWZW5kb3IgY2h1bmtzXHJcbiAgICAgICAgICAndnVlLXZlbmRvcic6IFsndnVlJywgJ3Z1ZS1yb3V0ZXInXSxcclxuICAgICAgICAgICdwaW5pYS12ZW5kb3InOiBbJ3BpbmlhJ10sXHJcbiAgICAgICAgICBcclxuICAgICAgICAgIC8vIEZlYXR1cmUgY2h1bmtzXHJcbiAgICAgICAgICAnY29udmVyc2F0aW9uJzogW1xyXG4gICAgICAgICAgICAnLi9zcmMvdmlld3MvQ29udmVyc2F0aW9uTGlzdC52dWUnLFxyXG4gICAgICAgICAgICAnLi9zcmMvdmlld3MvQ29udmVyc2F0aW9uRGV0YWlsLnZ1ZScsXHJcbiAgICAgICAgICAgICcuL3NyYy9jb21wb25lbnRzL2NvbnZlcnNhdGlvbi9Db252ZXJzYXRpb25DYXJkLnZ1ZScsXHJcbiAgICAgICAgICAgICcuL3NyYy9jb21wb25lbnRzL2NvbnZlcnNhdGlvbi9NZXNzYWdlQnViYmxlLnZ1ZSdcclxuICAgICAgICAgIF0sXHJcbiAgICAgICAgICAnZGFzaGJvYXJkJzogWycuL3NyYy92aWV3cy9EYXNoYm9hcmQudnVlJ10sXHJcbiAgICAgICAgICAnYXV0aCc6IFsnLi9zcmMvdmlld3MvTG9naW4udnVlJywgJy4vc3JjL3N0b3Jlcy9hdXRoLnRzJ10sXHJcbiAgICAgICAgICAnY29tcG9zYWJsZXMnOiBbXHJcbiAgICAgICAgICAgICcuL3NyYy9jb21wb3NhYmxlcy91c2VBdXRoLnRzJyxcclxuICAgICAgICAgICAgJy4vc3JjL2NvbXBvc2FibGVzL3VzZUNvbnZlcnNhdGlvbnMudHMnLFxyXG4gICAgICAgICAgICAnLi9zcmMvY29tcG9zYWJsZXMvdXNlTWVzc2FnZXMudHMnLFxyXG4gICAgICAgICAgICAnLi9zcmMvY29tcG9zYWJsZXMvdXNlTW9kZXJuVnVlLnRzJ1xyXG4gICAgICAgICAgXSxcclxuICAgICAgICAgIFxyXG5cclxuICAgICAgICAgIFxyXG4gICAgICAgICAgLy8gTW9jayBkYXRhIChvbmx5IGluIGRldmVsb3BtZW50KVxyXG4gICAgICAgICAgLi4uKHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSAnZGV2ZWxvcG1lbnQnID8ge1xyXG4gICAgICAgICAgICAnbW9jay1kYXRhJzogWycuL3NyYy91dGlscy9tb2NrRGF0YS50cyddXHJcbiAgICAgICAgICB9IDoge30pXHJcbiAgICAgICAgfSxcclxuICAgICAgICAvLyBPcHRpbWl6ZSBjaHVuayBmaWxlIG5hbWVzXHJcbiAgICAgICAgY2h1bmtGaWxlTmFtZXM6IChjaHVua0luZm8pID0+IHtcclxuICAgICAgICAgIGNvbnN0IGZhY2FkZU1vZHVsZUlkID0gY2h1bmtJbmZvLmZhY2FkZU1vZHVsZUlkXHJcbiAgICAgICAgICBpZiAoZmFjYWRlTW9kdWxlSWQpIHtcclxuICAgICAgICAgICAgY29uc3QgbmFtZSA9IGZhY2FkZU1vZHVsZUlkLnNwbGl0KCcvJykucG9wKCk/LnJlcGxhY2UoJy52dWUnLCAnJykgfHwgJ2NodW5rJ1xyXG4gICAgICAgICAgICByZXR1cm4gYGFzc2V0cy8ke25hbWV9LVtoYXNoXS5qc2BcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIHJldHVybiAnYXNzZXRzL1tuYW1lXS1baGFzaF0uanMnXHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9LFxyXG4gICAgLy8gT3B0aW1pemUgYXNzZXQgaGFuZGxpbmdcclxuICAgIGFzc2V0c0lubGluZUxpbWl0OiA0MDk2LCAvLyBJbmxpbmUgYXNzZXRzIHNtYWxsZXIgdGhhbiA0a2JcclxuICAgIGNzc0NvZGVTcGxpdDogdHJ1ZSwgLy8gU3BsaXQgQ1NTIGludG8gc2VwYXJhdGUgZmlsZXNcclxuICAgIHNvdXJjZW1hcDogZmFsc2UgLy8gRGlzYWJsZSBzb3VyY2VtYXBzIGluIHByb2R1Y3Rpb25cclxuICB9LFxyXG4gIC8vIEVuYWJsZSBjb21wcmVzc2lvbiBpbiBkZXZlbG9wbWVudCBmb3IgdGVzdGluZ1xyXG4gIGVzYnVpbGQ6IHtcclxuICAgIGRyb3A6IHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSAncHJvZHVjdGlvbicgPyBbJ2NvbnNvbGUnLCAnZGVidWdnZXInXSA6IFsnZGVidWdnZXInXVxyXG4gIH1cclxufSkiXSwKICAibWFwcGluZ3MiOiAiO0FBQTZVLFNBQVMsb0JBQW9CO0FBQzFXLE9BQU8sU0FBUztBQUNoQixTQUFTLGVBQWU7QUFDeEIsU0FBUyxrQkFBa0I7QUFDM0IsT0FBTyxxQkFBcUI7QUFKNUIsSUFBTSxtQ0FBbUM7QUFNekMsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUztBQUFBLElBQ1AsSUFBSTtBQUFBO0FBQUEsSUFFSixnQkFBZ0I7QUFB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
