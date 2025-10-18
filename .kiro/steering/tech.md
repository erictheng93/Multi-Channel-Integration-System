# Technology Stack /

## Backend (Cloudflare Worker) / (Cloudflare Worker)

- **Runtime / **: Cloudflare Workers
- **Framework / **: Hono (lightweight web framework / Web )
- **Database / **: Cloudflare D1 (SQLite)
- **Language / **: TypeScript
- **Authentication / **: JWT with bcryptjs for password hashing / JWT bcryptjs

### Key Dependencies /
- `hono`: Web framework for Cloudflare Workers / Cloudflare Workers Web
- `bcryptjs`: Password hashing /
- `jsonwebtoken`: JWT token management / JWT
- `uuid`: UUID generation for message IDs / ID UUID

## Frontend /

- **Framework / **: Vue 3 (Composition API / API)
- **State Management / **: Pinia
- **Router / **: Vue Router 4
- **Build Tool / **: Vite
- **Language / **: TypeScript
- **Styling / **: Native CSS (no framework dependencies / )

## Database Schema /

Uses Cloudflare D1 with the following main tables: / Cloudflare D1
- `users`: Platform users (LINE/Facebook users) / LINE/Facebook
- `conversations`: Chat conversations /
- `messages`: Individual messages /
- `agents`: Customer service agents /
- `customers`: Legacy customer data (being migrated to users) / users

## Common Commands /

### Development /
```bash
# Start backend development server /
npm run dev

# Start frontend development server (in frontend/) / frontend/
cd frontend && npm run dev

# Type checking /
npm run build
```

### Database Management /
```bash
# Local database migration /
npm run db:migrate

# Production database migration /
npm run db:migrate:prod

# Seed database with test data /
npm run db:seed
```

### Deployment /
```bash
# Deploy to Cloudflare Workers / Cloudflare Workers
npm run deploy

# Generate Cloudflare types / Cloudflare
npm run cf-typegen
```

### Testing /
```bash
# Run tests (in tests/) / tests/
cd tests && npm test

# Run specific test files /
node tests/test-line-connection.ts
```

## Configuration Files /

- `wrangler.toml`: Cloudflare Worker configuration / Cloudflare Worker
- `tsconfig.json`: TypeScript configuration / TypeScript
- `package.json`: Dependencies and scripts /
- `.env` files: Environment variables (not committed) / 