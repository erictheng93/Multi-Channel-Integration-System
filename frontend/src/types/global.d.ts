// 全域類型定義
// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/frontend/src/types/global.d.ts

/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// Vite 環境變數類型
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_APP_TITLE: string
  readonly VITE_APP_VERSION: string
  readonly VITE_DEBUG: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// 全域 Vue 類型擴展
declare global {
  namespace NodeJS {
    interface Timeout {}
  }
}