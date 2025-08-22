import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './database/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: './.wrangler/state/v3/d1/miniflare-D1DatabaseObject/fbb73f5782493dd2e25194065f2eb8a019035307f58d5135ab88d0705187ea24.sqlite',
  },
});