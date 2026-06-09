/**
 * Shared localhost origins for development-only CORS and security allowlists.
 */
export const DEVELOPMENT_ORIGINS = [
  'http://localhost:5173',
  'https://localhost:5173',
  'http://localhost:3000',
  'https://localhost:3000',
  'http://localhost:3001',
  'https://localhost:3001',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'https://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'https://127.0.0.1:3001',
  'http://localhost:8787',
  'http://127.0.0.1:8787',
] as const
