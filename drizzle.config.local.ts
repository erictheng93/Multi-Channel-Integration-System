import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './database/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: './.wrangler/state/v3/d1/miniflare-D1DatabaseObject/3ae7f87aeefa5f64bb7b0fef32841f3f5dff3469e1061c248cb1a19877076f99.sqlite',
  },
});