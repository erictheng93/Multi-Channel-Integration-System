// ESLint config for the Bun/Node tooling outside the Worker bundle and the SPA:
// scripts/, tools/, database/ (repo root). Run from the repo root with
// `bun run lint:scripts`. It lives in frontend/ only because that is where
// eslint and its plugins are installed (the repo root has no ESLint dependency).
// Mirrors the TS rules of eslint.config.js, without Vue or browser globals.
import js from '@eslint/js'
import typescript from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser'

const nodeGlobals = {
  console: 'readonly',
  process: 'readonly',
  Buffer: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  global: 'readonly',
  globalThis: 'readonly',
  module: 'readonly',
  require: 'readonly',
  exports: 'readonly',
  setTimeout: 'readonly',
  setInterval: 'readonly',
  setImmediate: 'readonly',
  clearTimeout: 'readonly',
  clearInterval: 'readonly',
  fetch: 'readonly',
  Headers: 'readonly',
  Request: 'readonly',
  Response: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
  AbortController: 'readonly',
  AbortSignal: 'readonly',
  FormData: 'readonly',
  Blob: 'readonly',
  File: 'readonly',
  crypto: 'readonly',
  atob: 'readonly',
  btoa: 'readonly',
  performance: 'readonly',
  structuredClone: 'readonly',
  Bun: 'readonly',
}

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/*.d.ts',
      // Local-only scratch files (gitignored; tsconfig.scripts.json excludes them too).
      '**/test-*.ts',
    ],
  },

  js.configs.recommended,

  {
    files: ['**/*.ts', '**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
      globals: nodeGlobals,
    },
    plugins: { '@typescript-eslint': typescript },
    rules: {
      // tsc (type-check:scripts) already reports undefined names; the base rule
      // does not understand TS-only globals such as RequestInit.
      'no-undef': 'off',
      // The base rule false-positives on TS types/overloads; use the TS one.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-explicit-any': 'error',
      // Off (the frontend config only warns): dev scripts assert on Map lookups and
      // regex matches they just populated, and tsc strict still checks everything else.
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],

      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
    },
  },

  // CommonJS helpers
  {
    files: ['**/*.cjs'],
    languageOptions: { parserOptions: { sourceType: 'commonjs' } },
  },
]
