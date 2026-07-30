import js from '@eslint/js'
import vue from 'eslint-plugin-vue'
import typescript from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser'
import vueParser from 'vue-eslint-parser'

export default [
  // Ignore patterns - migrated from .eslintignore
  {
    ignores: [
      'dist/**/*',
      'node_modules/**/*',
      '*.d.ts',
      '.eslintrc.cjs',
      'vite.config.ts',
      'coverage/**/*',
      '.vite/**/*',
      '**/*.timestamp-*',
      'scripts/**/*.cjs',
      // Playwright output. These hold a bundled HTML report with minified
      // inline JS, so without this, running any Playwright suite makes
      // `lint:check` (and therefore the pre-push hook) fail with thousands of
      // no-var/eqeqeq/no-undef errors from generated code.
      '**/.playwright-report/**',
      '**/.playwright-artifacts/**',
      '**/playwright-report/**',
      '**/test-results/**'
    ]
  },
  
  js.configs.recommended,
  ...vue.configs['flat/recommended'],
  
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.vue', '**/*.js', '**/*.jsx'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: typescriptParser,
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        history: 'readonly',
        fetch: 'readonly',
        Headers: 'readonly',
        RequestInit: 'readonly',
        URLSearchParams: 'readonly',
        URL: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        MouseEvent: 'readonly',
        KeyboardEvent: 'readonly',
        InputEvent: 'readonly',
        FocusEvent: 'readonly',
        WheelEvent: 'readonly',
        UIEvent: 'readonly',
        DragEvent: 'readonly',
        // File API
        File: 'readonly',
        FileList: 'readonly',
        FileReader: 'readonly',
        EventTarget: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLFormElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLImageElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        HTMLVideoElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLSpanElement: 'readonly',
        HTMLCanvasElement: 'readonly',
        CanvasRenderingContext2D: 'readonly',
        Element: 'readonly',
        TextDecoder: 'readonly',
        HTMLSelectElement: 'readonly',
        HTMLOptionElement: 'readonly',
        HTMLAnchorElement: 'readonly',
        DataTransfer: 'readonly',
        Storage: 'readonly',
        IdleDeadline: 'readonly',
        // Storage and utilities
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        crypto: 'readonly',
        Blob: 'readonly',
        // Web Workers
        self: 'readonly',
        importScripts: 'readonly',
        MessageEvent: 'readonly',
        // Service Worker
        clients: 'readonly',
        caches: 'readonly',
        // Server-Sent Events
        EventSource: 'readonly',
        // Performance
        performance: 'readonly',
        // Notification API
        Notification: 'readonly',
        NotificationPermission: 'readonly',
        NotificationOptions: 'readonly',
        Audio: 'readonly',
        // Node.js types (for type references)
        NodeJS: 'readonly',
        // Cloudflare Workers
        EventContext: 'readonly',
        Response: 'readonly',
        // Bun runtime
        Bun: 'readonly',
      }
    },
    
    plugins: {
      '@typescript-eslint': typescript,
      vue,
    },
    
    rules: {
      // Vue specific rules
      'vue/multi-word-component-names': 'off',
      'vue/no-unused-vars': 'error',
      'vue/component-definition-name-casing': ['error', 'PascalCase'],
      'vue/component-name-in-template-casing': ['error', 'PascalCase'],
      'vue/define-macros-order': ['error', {
        order: ['defineOptions', 'defineProps', 'defineEmits', 'defineSlots']
      }],
      'vue/no-undef-components': ['warn', {
        ignorePatterns: ['router-link', 'router-view']
      }],
      'vue/no-unused-components': 'error',
      'vue/prefer-import-from-vue': 'error',
      'vue/require-macro-variable-name': 'error',
      
      // TypeScript rules
      '@typescript-eslint/no-unused-vars': ['error', { 
        argsIgnorePattern: '^_', 
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/prefer-optional-chain': 'off',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      
      // General rules
      'no-console': process.env.NODE_ENV === 'production'
        ? ['error', { allow: ['warn', 'error'] }]
        : 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],

      // Naming conventions - 強制使用 camelCase
      'camelcase': ['error', {
        'properties': 'always',
        'ignoreDestructuring': false,
        'allow': [
          // 允許環境變量使用 SCREAMING_SNAKE_CASE
          '^VITE_',
          'API_BASE_URL',
          'JWT_SECRET',
          // 允許通知類型使用 snake_case (與後端 API 保持一致)
          'new_message',
          'conversation_assigned',
          'conversation_transferred',
          'priority_changed',
          'customer_responded',
          'task_reminder',
          // 允許 ReportType 使用 snake_case (與後端 API 保持一致)
          'conversation_summary',
          'agent_performance',
          'team_analytics',
          'customer_satisfaction',
          'platform_usage',
          'message_statistics',
          'response_time_analysis',
          'workload_distribution',
          'system_health',
          'cost_analysis',
          'sla_compliance',
          'anomaly_detection',
          'audit_trail',
          'resource_utilization',
          'trend_forecast',
          'customer_insights',
          'channel_integration',
          'goal_achievement',
          'automation_effectiveness',
          'security_risk',
          'knowledge_base',
          'call_quality',
          'executive_summary',
          // 允許資料庫欄位名稱使用 snake_case (與後端 schema 保持一致)
          'file_attachments'
        ]
      }]
    },
  },

  // Test files overrides - relaxed rules for test code
  {
    files: ['tests/**/*', 'src/**/*.test.ts', 'src/**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'camelcase': 'off'
    }
  },
  
  // Vue files specific overrides
  {
    files: ['*.vue', '**/*.vue'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off' // Vue 模板中的變數使用由 vue/no-unused-vars 處理
    }
  },
  
  // Config files overrides
  {
    files: ['*.config.js', '*.config.ts', 'scripts/**/*', 'prettier.config.ts', 'vitest.setup.ts'],
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },

  // Team modal files overrides - allow prop mutation for form bindings
  {
    files: ['src/components/team/*Modal.vue'],
    rules: {
      'vue/no-mutating-props': 'off'
    }
  },

  // Icons files overrides
  {
    files: ['src/components/icons/**/*.ts'],
    rules: {
      'vue/one-component-per-file': 'off'
    }
  }
]
