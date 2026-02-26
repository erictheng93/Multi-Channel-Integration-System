/// <reference types="vite/client" />

/**
 * Vite environment variable type declarations
 */
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_OAUTH_REDIRECT_URI: string;
  readonly VITE_ENVIRONMENT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Vue Single File Component module declarations
 */
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<
    Record<string, unknown>,
    Record<string, unknown>,
    unknown
  >;
  export default component;
}
