import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './database/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: './.wrangler/state/v3/d1/miniflare-D1DatabaseObject/dc23354e195c301b4778615a1d18f9e116936b7ddbf1fa5ed62c6ac8bb6640a8.sqlite',
  },
});