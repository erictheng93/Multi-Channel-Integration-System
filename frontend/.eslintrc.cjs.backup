/* eslint-env node */
module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:vue/vue3-recommended', // 升級到 recommended 規則
    '@vue/eslint-config-typescript/recommended' // 使用推薦的 TypeScript 規則
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parser: '@typescript-eslint/parser'
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
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'error',
    'prefer-template': 'error',
    'eqeqeq': ['error', 'always'],
    'curly': ['error', 'all']
  },
  env: {
    node: true,
    browser: true,
    es2022: true,
    'vue/setup-compiler-macros': true
  },
  overrides: [
    {
      files: ['*.vue'],
      rules: {
        // Vue 文件特定規則
        '@typescript-eslint/no-unused-vars': 'off' // Vue 模板中的變數使用由 vue/no-unused-vars 處理
      }
    },
    {
      files: ['*.config.js', '*.config.ts', 'scripts/**/*', 'prettier.config.ts', 'vitest.setup.ts'],
      rules: {
        // 對配置文件放寬規則
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/no-explicit-any': 'off'
      }
    },
    {
      files: ['src/components/icons/**/*.ts'],
      rules: {
        // 圖示文件可以包含多個組件
        'vue/one-component-per-file': 'off'
      }
    }
  ]
}