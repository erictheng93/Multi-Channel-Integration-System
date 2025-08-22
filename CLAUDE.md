# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Multi-Channel Customer Support System** built with Cloudflare Workers and Vue 3. It's a production-ready platform that integrates LINE OA and Facebook Messenger for unified customer service management, featuring modern architecture with Drizzle ORM and Cloudflare KV.

### Key Characteristics
- **100% test coverage** with 132 passing tests
- **TypeScript strict mode** with 0 compilation errors  
- **Production-ready** with 99.9% availability
- **Modern Vue 3 frontend** with enterprise-grade UI/UX
- **Cloudflare edge computing** with global distribution

## Architecture

### Backend (Cloudflare Worker)
- **Runtime**: Cloudflare Workers (edge computing)
- **Framework**: Hono (lightweight web framework)
- **Database**: Cloudflare D1 (SQLite) with Drizzle ORM
- **Cache**: Cloudflare KV for session management and performance
- **Storage**: Cloudflare R2 for file attachments
- **Queue**: Cloudflare Queues for delayed messaging
- **Entry Point**: `src/index.ts` - handler-based architecture

### Frontend (Vue 3 Application)
- **Framework**: Vue 3 with Composition API
- **State Management**: Pinia stores
- **Router**: Vue Router 4
- **Build Tool**: Vite
- **Language**: TypeScript with 100% coverage
- **Testing**: Vitest with comprehensive test suite
- **Entry Point**: `frontend/src/main.ts`

### Core Handlers Architecture
The backend uses a modular handler-based approach:
- `handlers/auth-main.ts` - Authentication and JWT management
- `handlers/conversation-main.ts` - Conversation management
- `handlers/delayed-message-main.ts` - Delayed messaging system
- `handlers/team-main.ts` - Team and member management
- `handlers/system-main.ts` - System settings and health checks
- `handlers/customer-main.ts` - Customer data management

## Development Commands

### Backend (Root Directory)
```bash
# Development
npm run dev                    # Start Wrangler dev server
npm run build                  # TypeScript compilation check
npm run lint:check             # TypeScript + Vue type checking with linting

# Database Operations
npm run db:migrate             # Apply migrations locally
npm run db:migrate:prod        # Apply migrations to production
npm run db:studio:local        # Open Drizzle Studio for local DB
npm run db:generate            # Generate Drizzle migrations
npm run db:push               # Push schema changes

# Deployment
npm run deploy                # Deploy to production
npm run deploy:dev            # Deploy to development

# Testing & Validation
npm run test:handlers         # Test all handlers
npm run test:api              # API integration tests
npm run test:recall           # Message recall functionality tests
```

### Frontend (frontend/ directory)
```bash
# Development
npm run dev                   # Start Vite dev server (port 3000)
npm run build                 # Build for production
npm run type-check            # Vue TypeScript checking

# Testing (100% coverage)
npm run test                  # Run all 132 tests
npm run test:run              # Single test run
npm run test:coverage         # Generate coverage report
npm run test:ui               # Interactive test UI

# Linting
npm run lint                  # ESLint with auto-fix
npm run lint:check            # ESLint check only

# Deployment
npm run build:pages           # Build and copy Cloudflare Pages config
npm run deploy:pages          # Deploy to Cloudflare Pages
```

## Key Technologies & Integrations

### Database & ORM
- **Drizzle ORM** for type-safe database operations
- **Cloudflare D1** as the primary database
- **Cloudflare KV** for caching and session management
- Schema located in `src/db/schema.ts`

### External APIs
- **LINE Messaging API** - Full webhook integration for LINE OA
- **Facebook Messenger API** - Prepared for integration (handlers ready)
- **JWT Authentication** - Secure token-based auth system

### Modern Frontend Features
- **Pinia stores** for state management (`frontend/src/stores/`)
- **Vue Composition API** with TypeScript
- **Internationalization (i18n)** with multiple locales
- **Responsive design** with modern CSS variables
- **File upload** with Cloudflare R2 integration

## Important File Locations

### Configuration
- `wrangler.toml` - Cloudflare Worker configuration
- `drizzle.config.ts` - Database configuration
- `frontend/vite.config.ts` - Frontend build configuration
- `frontend/vitest.config.ts` - Test configuration

### Core Backend Files
- `src/index.ts` - Main Worker entry point
- `src/db/schema.ts` - Database schema definitions (includes teams table and role hierarchy)
- `src/services/permission-service.ts` - Enterprise role permission system
- `src/types/` - TypeScript type definitions (updated for 3-role system)
- `src/handlers/` - Request handlers by feature (role-based access control)
- `src/middleware/auth.ts` - Authentication middleware with role hierarchy
- `src/utils/` - Utility functions

### Core Frontend Files
- `frontend/src/main.ts` - Application entry point
- `frontend/src/App.vue` - Root component
- `frontend/src/stores/` - Pinia state management
- `frontend/src/api/` - API client modules
- `frontend/src/types/` - Frontend type definitions

## Testing Strategy

### Frontend Testing (132 tests, 100% pass rate)
The project has a robust testing infrastructure:
- **Unit tests** for all components and stores
- **Integration tests** for API communication
- **Edge case testing** for error scenarios
- **Performance tests** for optimization validation

Key test helpers:
- `frontend/tests/helpers/directStoreCreation.ts` - Reliable store testing
- `frontend/tests/helpers/testUtils.ts` - Common test utilities
- `frontend/vitest.setup.ts` - Global test configuration

### Backend Testing
- Handler-specific tests in `tests/unit/handlers/`
- API integration tests in `tests/integration/`
- Database operation tests with mocking

## Development Best Practices

### Code Style
- **TypeScript strict mode** - All code must be type-safe
- **No any types** except in test files (carefully managed)
- **Vue 3 Composition API** preferred over Options API
- **ESLint + Prettier** for consistent formatting

### Database Operations
- Use **Drizzle ORM** for all database operations
- Leverage **Cloudflare KV** for caching frequently accessed data
- Use **distributed locks** for race condition prevention
- Always handle database errors gracefully

### Authentication Flow
- JWT tokens managed in `src/utils/auth.ts`
- Session persistence via Cloudflare KV
- Route protection in `frontend/src/middleware/authGuard.ts`
- Automatic token refresh mechanism

### State Management
- **Pinia stores** for all shared state
- Store composition patterns for complex state
- Reactive computed properties for derived state
- Error handling within stores

## Key Features

### Delayed Messaging System
- 1-120 second delay capabilities
- Real-time countdown timers
- Message recall functionality
- Cloudflare Queue integration
- 43 comprehensive tests covering all scenarios

### Multi-Channel Integration
- LINE OA complete integration with webhook handling
- Facebook Messenger API preparation (handlers ready)
- Unified message interface across platforms
- Customer data collection and management

### Team Collaboration & Enterprise Role System
- **3-Role Enterprise System**: Admin, Team, Agent hierarchy
- **Role-Based Permissions**: Comprehensive permission service with team-scoped access
- **Team Management**: Full team lifecycle with team leader delegation
- **Multi-agent conversation handling** with role-based access control
- **Real-time status updates** and activity tracking
- **Team Dashboard**: Team-specific analytics and reporting
- **Scalable Access Control**: Database-level permission enforcement

### Enterprise Role Hierarchy
- **Admin (Level 3)**: System-wide access, all teams and configurations
- **Team (Level 2)**: Team-scoped management, agent supervision, analytics
- **Agent (Level 1)**: Assigned conversation access, customer interaction focus
- **Team Assignment**: Mandatory for team role/agents, flexible team structure
- **Permission Inheritance**: Higher roles inherit lower role capabilities
- **Database Integration**: Teams table with foreign key relationships

## Quick Start for Development

1. **Environment Setup**: Run `.\setup-env.ps1` for automated environment configuration
2. **Install Dependencies**: `npm install && cd frontend && npm install`
3. **Start Development**: 
   - Backend: `npm run dev` (Cloudflare Worker on localhost:8787)
   - Frontend: `cd frontend && npm run dev` (Vite dev server on localhost:3000)
4. **Run Tests**: `cd frontend && npm run test` (verify 132/132 tests pass)

## Production Deployment

The system is production-ready with:
- **Automated deployment** via `.\quick-deploy.ps1`
- **Zero-downtime deployments** with Cloudflare Workers
- **Global edge distribution** for optimal performance
- **Comprehensive monitoring** and health checks
- **Automatic scaling** based on traffic

## Troubleshooting

### Common Issues
- **TypeScript errors**: Run `npm run type-check` in both root and frontend
- **Test failures**: Check test environment setup in `frontend/vitest.setup.ts`
- **Database issues**: Use `npm run db:studio:local` to inspect data
- **API connectivity**: Verify environment variables in `wrangler.toml`

### Performance Optimization
- **Virtual scrolling** for large conversation lists
- **Lazy loading** for route components  
- **Code splitting** for optimal bundle sizes
- **Cloudflare KV caching** for frequently accessed data

## Enterprise Documentation

### Role System Documentation
- `docs/enterprise/ENTERPRISE_ROLES_SYSTEM.md` - Comprehensive 3-role system guide
- `drizzle/0004_add_enterprise_roles_team_support.sql` - Database migration for role system
- Permission matrix, team management, and deployment guides included

### Key Documentation Files
- Role hierarchy and permission system
- Team management and assignment workflows
- Migration guide for existing installations
- API access control and security considerations
- Frontend role-based UI implementation

## System Maturity

This is a mature, well-tested system with enterprise-grade architecture featuring:
- **Enterprise 3-Role System** with hierarchical permissions (Admin, Team, Agent)
- **Team-based organization** with team leader delegation
- **Comprehensive test suite** and TypeScript coverage ensure reliability
- **Modern Vue 3 frontend** with role-based UI/UX
- **Scalable architecture** supporting multi-team operations