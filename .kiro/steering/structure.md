# Project Structure /

## Root Directory Layout /

```
 src/ # Backend Worker source code / Worker
 frontend/ # Vue.js frontend application / Vue.js
 shared/ # Shared types between frontend/backend /
 database/ # Database schema and migration files /
 tests/ # Test files and utilities /
 docs/ # Documentation and guides /
 .kiro/ # Kiro configuration and steering / Kiro
 config files # Various configuration files /
```

## Backend Structure (`src/`) / (`src/`)

```
src/
 handlers/ # Request handlers (modular API endpoints) / API
 webhook.ts # Webhook processing (LINE/Facebook) / Webhook LINE/Facebook
 auth.ts # Authentication endpoints /
 conversation.ts # Conversation management /
 message.ts # Message handling /
 types/ # TypeScript type definitions / TypeScript
 shared.ts # Modern shared types /
 converters.ts # Type conversion utilities /
 index.ts # Legacy database types /
 utils/ # Utility functions /
 services/ # Business logic services /
 middleware/ # Authentication and other middleware /
 integrations/ # Platform adapters (LINE, Facebook) / LINEFacebook
 durable-objects/ # Cloudflare Durable Objects / Cloudflare
 index.ts # Main system entry point /
 index-simple.ts # Simplified version /
```

## Frontend Structure (`frontend/src/`) / (`frontend/src/`)

```
frontend/src/
 views/ # Page components /
 components/ # Reusable Vue components / Vue
 stores/ # Pinia state management / Pinia
 api/ # API client functions / API
 types/ # Frontend-specific types /
 router/ # Vue Router configuration / Vue Router
 main.ts # Application entry point /
```

## Key Architecture Patterns /

### Entry Points /
- `src/index.ts`: Main system entry point with full features /
- `src/index-simple.ts`: Simplified version for basic use cases /

### Handler Pattern /
All API endpoints are organized into handler modules: / API
- Each handler exports functions for specific routes /
- Handlers use dependency injection pattern with Cloudflare bindings / Cloudflare
- Consistent error handling and response formatting /

### Type System /
- **Legacy types** (`src/types/index.ts`): Database-focused types / ****
- **Modern types** (`src/types/shared.ts`): Clean, frontend-friendly types / ****
- **Converters** (`src/types/converters.ts`): Transform between type systems / ****

### Database Organization /
- `database/schema.sql`: Main database schema /
- `database/init.sql`: Initial setup queries /
- `database/init-database.ps1`: Database initialization script /
- `database/verify-schema.js`: Schema validation /

### Testing Structure /
- `tests/unit/`: Unit tests /
- `tests/helpers/`: Test utilities /
- Individual test files for specific features /
- PowerShell scripts for integration testing / PowerShell

## Configuration Files /

- `wrangler.toml`: Cloudflare Worker deployment configuration / Cloudflare Worker
- `tsconfig.json`: TypeScript compiler settings / TypeScript
- `package.json`: Dependencies and npm scripts / npm
- Frontend has its own `package.json` and `vite.config.ts` / `package.json` `vite.config.ts`

## Naming Conventions /

- **Files / **: kebab-case for most files, PascalCase for components / kebab-case PascalCase
- **Directories / **: lowercase with hyphens /
- **Types / **: PascalCase for interfaces and types / PascalCase
- **Functions / **: camelCase
- **Constants / **: UPPER_SNAKE_CASE
- **Database / **: snake_case for table and column names / snake_case

## Import Patterns /

```typescript
// Relative imports for local modules /
import { webhookHandler } from './handlers/webhook';

// Type imports /
import type { Bindings, User, Conversation } from './types';

// Shared types /
import type { SharedUser } from '@/types/shared';
```