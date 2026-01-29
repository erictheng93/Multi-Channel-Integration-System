# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a multi-channel customer support system built on Cloudflare Workers and Vue 3, supporting unified management of LINE OA and Facebook Messenger integrations. The system uses TypeScript throughout and follows a modern serverless architecture.

## Core Architecture

- **Backend**: Cloudflare Workers with Hono framework
- **Database**: Cloudflare D1 (SQLite) with KV storage for sessions/cache
- **Frontend**: Vue 3 with Composition API, Pinia state management
- **Build Tools**: Vite for frontend, Wrangler for Worker deployment
- **Testing**: Vitest with extensive test suites

## Key Development Commands

### Backend (Worker)
```bash
# Development with local D1
npm run dev # Start Wrangler dev server
npm run build # TypeScript compilation check
npm run deploy # Deploy to Cloudflare Workers
npm run cf-typegen # Generate Cloudflare types

# Database management
npm run db:migrate # Apply migrations locally
npm run db:migrate:prod # Apply migrations to production
npm run db:seed # Seed local database
```

### Frontend
```bash
cd frontend/
npm run dev # Start Vite dev server
npm run build # Build for production (includes vue-tsc)
npm run preview # Preview production build
```

### Testing
```bash
cd tests/
npm run test # Run all Vitest tests
npm run test:run # Single test run
npm run test:coverage # Run with coverage
npm run test:watch # Watch mode

# Specific test suites
npm run test:database # Database layer tests
npm run test:line # LINE integration tests
npm run test:conversation # Conversation handler tests
npm run test:message # Message handler tests
npm run test:services # Service layer tests
```

#### Test Infrastructure Notes
- ** Pinia Timing Issues SOLVED**: Use `setupDirectStoreTest()` for store testing - no more "getActivePinia" errors
- **Direct Store Creation**: Core solution using `directStoreCreation.ts` - bypasses module import timing issues
- **Global Setup**: Triple-layered setup via `global-pinia-setup.ts`, `setup.ts`, `vitest.setup.ts`
- **Test Utilities**: Use `setupBasicTest()` or `setupDirectStoreTest()` from helper files
- ** Critical**: Never import store modules directly in tests - use direct creation strategy
- **Performance**: Complex tests run efficiently (under 1 second) with the new infrastructure

### PowerShell Development Scripts
```powershell
# Main development startup
.\start-dev.ps1 # Starts both backend and frontend

# Database utilities
.\database\init-database.ps1 # Initialize database
.\database\status.ps1 # Check database status

# Testing utilities
.\tests\run-tests.ps1 # Run comprehensive test suite
.\tests\test-webhook.ps1 # Test webhook endpoints
```

## Project Structure

### Core Backend (`/src`)
- `index.ts` - Main Hono application with all routes
- `handlers/` - Route handlers (auth, conversation, message, webhook)
- `utils/` - Core utilities (database, auth, line, session, team)
- `services/` - Business logic services (permissions, QR codes, message recall)
- `middleware/` - Authentication and rate limiting middleware
- `integrations/` - Platform adapters (LINE, Facebook)
- `types/` - TypeScript definitions and converters

### Frontend (`/frontend/src`)
- `views/` - Vue page components (Login, Dashboard, Conversations, etc.)
- `stores/` - Pinia stores (auth, conversations)
- `api/` - API client modules (auth, conversations, messages)
- `composables/` - Vue composables (useError)
- `router/` - Vue Router configuration

### Database (`/database`)
- `schema.sql` - Complete database schema
- `init.sql` - Database initialization
- `status.ps1` - Database status checking

### Testing (`/tests`)
- `unit/` - Comprehensive unit tests organized by layer
- `helpers/` - Test utilities and mock setup
- Extensive PowerShell test runners for different components

## Development Workflow

1. **Database Setup**: Run `.\database\init-database.ps1` to initialize local D1 database
2. **Development**: Use `.\start-dev.ps1` to start both backend (port 8787) and frontend (port 3000)
3. **Testing**: Use specific test commands based on what you're working on
4. **Deployment**: Backend deploys via `wrangler deploy`, frontend can deploy to Cloudflare Pages

## Key Configuration Files

- `wrangler.toml` - Cloudflare Workers configuration with D1, KV, and Durable Objects
- `frontend/vite.config.ts` - Frontend build configuration with proxy setup
- `tests/vitest.config.ts` - Test configuration with proper mocking

## Important Notes

- The system uses both JWT and session-based authentication
- LINE webhooks require signature verification
- Database operations use prepared statements for security
- The codebase extensively uses TypeScript with strict typing
- All customer data collection is handled automatically via webhooks
- Team-based permissions system with QR code invitations

## Authentication & Security

- JWT tokens for API authentication
- Session management with KV storage
- LINE webhook signature verification required
- RBAC with admin/agent roles
- Rate limiting middleware available

## Platform Integrations

- **LINE**: Full Messaging API support with customer data collection
- **Facebook**: Partial implementation (webhook structure ready)
- Webhook endpoint: `/api/webhook` ()
- Platform adapters abstract integration complexity