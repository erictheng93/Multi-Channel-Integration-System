# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> 📚 **Extended Documentation**: Detailed guides are available in `docs/claude/` directory. See [Documentation Index](docs/claude/INDEX.md) for navigation.

## Project Overview

This is a **Multi-Channel Customer Support System** built with Cloudflare Workers and Vue 3. It's a comprehensive platform that integrates LINE OA and supports Facebook Messenger for unified customer service management, featuring **enterprise-grade architecture** with **100% WebSocket-based real-time communication** powered by Durable Objects.

### Key Characteristics
- **Modern Vue 3 + TypeScript** frontend with comprehensive testing (132+ tests)
- **Cloudflare Worker backend** with Hono framework and Drizzle ORM
- **Simplified role system** with Admin and Agent (2-tier hierarchy)
- **LINE OA integration** with complete webhook handling
- **Delayed messaging system** with Cloudflare Queues integration
- **File upload support** with Cloudflare R2 storage
- **Production deployment** on Cloudflare Pages and Workers
- **WebSocket real-time communication** with Durable Objects architecture (100% deployed)
- **🚀 Web Installer** - One-click self-hosted deployment system for customers (NEW - Production Ready)

## Architecture

### Backend (Cloudflare Worker)
- **Runtime**: Cloudflare Workers (edge computing)
- **Framework**: Hono (lightweight web framework)
- **Database**: Cloudflare D1 (SQLite) with Drizzle ORM for type-safe operations
- **Cache**: Cloudflare KV for session management and performance optimization
- **Storage**: Cloudflare R2 for file attachments and media
- **Queue**: Cloudflare Queues for delayed messaging and async processing
- **Real-time Communication**: **100% WebSocket** with Durable Objects architecture for stateful connections
- **Durable Objects**: Five production-ready classes (ConversationRoom, UserConnection, MessageBroadcaster, DelayedMessageProcessor, DelayedMessageBuffer)
- **Entry Point**: `src/index.ts` - handler-based modular architecture

### Frontend (Vue 3 Application)
- **Framework**: Vue 3 with Composition API and TypeScript
- **State Management**: Pinia stores for reactive state management
- **Router**: Vue Router 4 with authentication guards
- **Build Tool**: Vite with production optimization
- **Testing**: Vitest with 132+ comprehensive tests
- **UI Features**:
  - Responsive design with modern CSS
  - Virtual scrolling for large datasets (@tanstack/vue-virtual)
  - Internationalization (i18n) support
  - File upload with progress indicators
  - Real-time message updates via WebSocket
- **Entry Point**: `frontend/src/main.ts`

### Core Handlers Architecture
The backend uses a modular handler-based approach:
- `handlers/auth-main.ts` - Authentication and JWT management
- `handlers/conversation-main.ts` - Conversation CRUD operations
- `handlers/messaging-main.ts` - **Complete messaging system** with 17 endpoints (bulk ops, attachments, forwarding, tagging, export)
- `handlers/delayed-message-main.ts` - Delayed messaging with Cloudflare Queues
- `handlers/team-main.ts` - Team and member management
- `handlers/system-main.ts` - System settings and health monitoring
- `handlers/customer-main.ts` - Customer data management
- `handlers/tag-main.ts` - **Tag management system** with CRUD operations, bulk operations, and usage statistics
- `handlers/websocket-main.ts` - WebSocket connection management and routing
- `handlers/websocket-health.ts` - WebSocket health checks and monitoring
- `handlers/websocket-integration-test.ts` - WebSocket testing endpoints

### Services and Infrastructure
- `services/websocket-broadcast-service.ts` - **Production WebSocket broadcasting** with Durable Objects integration
- `services/websocket-auth-service.ts` - WebSocket authentication and authorization
- `durable-objects/` - **Five production-ready Durable Objects** for WebSocket state management
- `middleware/auth.ts` - JWT authentication middleware with role-based access
- `types/` - Comprehensive TypeScript definitions including WebSocket types

## Development Commands

> ⚠️ **IMPORTANT**: This project uses **REMOTE RESOURCES ONLY**. All development connects directly to production D1, KV, R2, and Durable Objects. There is no local development environment.

### Backend (Root Directory)
```bash
# Development (connects to REMOTE resources)
npm run dev              # Start Wrangler dev server with REMOTE bindings
npm run build            # TypeScript compilation check
npm run lint:check       # TypeScript + Vue type checking with linting

# Database Operations (all operate on REMOTE D1)
npm run db:migrate       # Apply migrations to REMOTE D1
npm run db:generate      # Generate Drizzle migrations
npm run db:push          # Push schema changes to REMOTE
npm run db:studio        # Open Drizzle Studio for REMOTE DB
npm run db:query         # Execute queries on REMOTE D1

# Deployment & Production
npm run deploy           # Deploy to production

# Health Checks & Monitoring
npm run health:check     # Check system health (formatted JSON)
npm run health:check:ws  # Check WebSocket health (formatted JSON)
npm run health:check:all # Check both system and WebSocket health
npm run health:check:detail # Detailed WebSocket health info
npm run monitor:deployment # Continuous health monitoring (every 30s)
npm run perf:baseline    # View WebSocket performance metrics

# Testing & Validation
npm run test:handlers    # Test all handlers
npm run test:api         # API integration tests
npm run test:upload      # File upload end-to-end tests

# Performance & Monitoring
npm run benchmark        # Run performance benchmark suite
npm run profile:memory   # Memory usage profiling
```

### Frontend (frontend/ directory)
```bash
# Development
npm run dev              # Start Vite dev server (port 3000)
npm run build            # Build for production
npm run type-check       # Vue TypeScript checking

# Testing (132+ tests)
npm run test             # Run all tests with Vitest
npm run test:run         # Single test run
npm run test:coverage    # Generate coverage report
npm run test:ui          # Interactive test UI

# Linting & Code Quality
npm run lint             # ESLint with auto-fix
npm run lint:check       # ESLint check only

# Deployment
npm run build:pages      # Build and copy Cloudflare Pages config
npm run deploy:pages     # Deploy to Cloudflare Pages
npm run verify:deployment # Verify production deployment
```

## Key Technologies & Integrations

### Database & ORM
- **Drizzle ORM** for type-safe database operations
- **Cloudflare D1** as the primary database
- **Cloudflare KV** for caching and session management
- Schema located in `src/db/schema.ts`
- **Recent Schema Optimizations** (Migration 0024-0027):
  - **Phase 1**: Added indexes for `agents` table (team_id, role)
  - **Phase 2**: Standardized `file_attachments` column naming to snake_case
  - **Phase 3**: Refactored `channel_integrations` to JSON-based config for extensibility
  - **Soft Delete**: Added `deletedAt` columns to core tables (teams, agents, customers, conversations, messages, tags)
  - **14+ Performance Indexes**: Optimized common query patterns

### External APIs
- **LINE Messaging API** - Full webhook integration for LINE OA
- **Facebook Messenger API** - Prepared for integration (handlers ready)
- **JWT Authentication** - Secure token-based auth system

### Modern Frontend Features
- **Vue 3 Composition API** with TypeScript for type-safe development
- **Pinia stores** for reactive state management (`frontend/src/stores/`)
- **Real-time communication** with **100% WebSocket** for live message updates and presence
- **Frontend Services**:
  - `frontend/src/services/websocketClient.ts` - **Production WebSocket client** with auto-reconnection
  - `frontend/src/services/websocketManager.ts` - WebSocket connection lifecycle management
  - `frontend/src/services/conversationSync.ts` - **WebSocket-based conversation sync service** with auto-reconnection
  - `frontend/src/api/` - HTTP API client modules
- **UI Components**:
  - Virtual scrolling with @tanstack/vue-virtual for performance
  - File upload with progress indicators and R2 integration
  - Responsive design with modern CSS and component library
  - Loading states and error handling components
  - **Confirmation dialogs** with promise-based API and multiple types (warning, danger, info)
- **Developer Experience**:
  - **Internationalization (i18n)** with Vue I18n
  - **Development tools** with Vite and TypeScript
  - **Testing infrastructure** with Vitest and Vue Test Utils
  - **Code quality** with ESLint and TypeScript strict mode

## Important File Locations

### Configuration
- `wrangler.toml` - Cloudflare Worker configuration with Durable Objects bindings
- `wrangler-websocket.toml` - WebSocket + Durable Objects production configuration
- `drizzle.config.ts` - Database configuration
- `frontend/vite.config.ts` - Frontend build configuration
- `frontend/vitest.config.ts` - Test configuration with WebSocket test environment
- `src/config/cors.ts` - **Unified CORS configuration** (single source of truth for all allowed origins)
- `src/config/runtime.ts` - **Runtime configuration layer** (backend URL, environment detection)
- `src/config/external-apis.ts` - **External API URLs** (LINE, Facebook, Cloudflare, etc.)
- `src/constants/` - **Unified constants management**
  - `src/constants/durable-objects.ts` - Durable Objects route constants
  - `src/constants/limits.ts` - Time, size, and quantity limits
- `src/monitoring/cors-monitor.ts` - CORS error monitoring and analytics

### Core Backend Files
- `src/index.ts` - Main Worker entry point with WebSocket routing
- `src/db/schema.ts` - Database schema definitions (includes teams table and role hierarchy)
- `src/services/permission-service.ts` - Enterprise role permission system
- `src/types/` - TypeScript type definitions (updated for 3-role system + WebSocket types)
  - `src/types/websocket-types.ts` - WebSocket and Durable Objects type definitions
  - `src/types/rollback-types.ts` - Emergency rollback system types
  - `src/types/deployment-types.ts` - Feature flags and deployment types
- `src/handlers/` - Request handlers by feature with WebSocket broadcasting integration
- `src/durable-objects/` - Durable Objects for stateful WebSocket management
- `src/services/websocket-broadcast-service.ts` - Unified WebSocket broadcasting
- `src/services/emergency-rollback-service.ts` - Emergency rollback and migration controls
- `src/monitoring/` - Performance monitoring and deployment tracking
- `src/middleware/auth.ts` - Authentication middleware with role hierarchy
- `src/utils/` - Utility functions

### Core Frontend Files
- `frontend/src/main.ts` - Application entry point with WebSocket initialization
- `frontend/src/App.vue` - Root component
- `frontend/src/stores/` - Pinia state management with real-time event handling
- `frontend/src/api/` - API client modules
- `frontend/src/services/` - WebSocket client services and connection management
- `frontend/src/composables/` - Vue composables for WebSocket functionality and UI interactions
  - `frontend/src/composables/useConfirmDialog.ts` - **Global confirmation dialog system** with singleton pattern and promise-based API
- `frontend/src/components/ui/` - Real-time UI components (status indicators, typing indicators)
- `frontend/src/views/ConversationDetail.vue` - Main conversation interface with WebSocket integration
- `frontend/src/types/` - Frontend type definitions including WebSocket types

## Environment Configuration System

**Pattern:** 3-layer architecture (env vars → runtime config → business logic)

**Key Functions:** `getBackendUrl()`, `getWebSocketUrl()`, `getFrontendUrl()`, `getStoragePublicUrl()`

**Configuration Files:**
- `frontend/.env.development` / `.env.production` - Frontend environment variables
- `.dev.vars` - Backend development environment variables
- `frontend/src/config/runtime.ts` (428 lines) - Frontend runtime configuration layer
- `src/config/runtime.ts` (300+ lines) - Backend runtime configuration layer
- `frontend/src/vite-env.d.ts` (150+ lines) - TypeScript environment variable definitions

**Quick Example:**
```typescript
import { getBackendUrl, getWebSocketUrl } from '@/config/runtime';
const apiUrl = getBackendUrl(); // ✅ Never hardcode URLs
const wsUrl = getWebSocketUrl(); // Auto protocol conversion
```

**Benefits:** 96% reduction in environment switching time (4-6 hours → 5-10 minutes)

📖 **Detailed Guide:** See [`docs/claude/ENVIRONMENT_CONFIG.md`](docs/claude/ENVIRONMENT_CONFIG.md) for complete 3-layer architecture, all environment variables, switching guide, best practices, and troubleshooting.

## Testing Strategy

**Frontend:** 132+ tests with 100% pass rate (components, stores, WebSocket, real-time features)

**Backend:** Handler tests, API integration tests, WebSocket infrastructure tests, load testing (1000+ connections)

**WebSocket Testing:**
- Unit tests (`tests/unit/durable-objects/`)
- Integration tests (`tests/integration/websocket/`)
- Performance tests (`tests/performance/websocket/`)
- E2E tests (`tests/e2e/websocket/`)

**Key Test Helpers:**
- `tests/helpers/websocket/WebSocketTestClient.ts` - Simulates real WebSocket connections
- `frontend/tests/helpers/directStoreCreation.ts` - Reliable store testing

📖 **Detailed Guide:** See [`docs/claude/TESTING.md`](docs/claude/TESTING.md) for complete testing infrastructure, running tests, and best practices.

## Development Best Practices

### Route Registration Order (⚠️ Critical)

**WHY IT MATTERS**: In Hono framework, route registration order determines routing priority. Routes registered later **cannot override** earlier catch-all routes.

**Priority Levels in `src/index.ts`:**
1. **Priority 1 (HIGHEST)**: Public endpoints (register BEFORE unified route system) - WebSocket health, CORS monitoring
2. **Priority 2**: Explicit auth endpoints (with jwtAuth middleware)
3. **Priority 3**: Unified route system (RouteRegistry batch registration)
4. **Priority 4**: Fine-grained individual routes (system settings, credentials)

**Common Pitfall:**
```typescript
// ❌ BAD: Register after unified route system
const routeRegistry = new RouteRegistry(app);
routeGroups.forEach(group => routeRegistry.registerGroup(group));
app.route('/api/myendpoint', myHandler); // TOO LATE - will be intercepted!

// ✅ GOOD: Pre-register BEFORE unified route system
app.route('/api/myendpoint', myHandler); // PRIORITY
const routeRegistry = new RouteRegistry(app);
routeGroups.forEach(group => routeRegistry.registerGroup(group));
```

📖 **Detailed Guide:** See [`docs/claude/ROUTE_REGISTRATION.md`](docs/claude/ROUTE_REGISTRATION.md) for complete priority levels, checklist, examples, and debugging tips.

---

### Code Style
- **TypeScript strict mode** - All code must be type-safe
- **No any types** except in test files (carefully managed)
- **Vue 3 Composition API** preferred over Options API
- **ESLint + Prettier** for consistent formatting

### Database Operations
- Use **Drizzle ORM** for all database operations
- Leverage **Cloudflare KV** for caching frequently accessed data
- Use **distributed locks** for race condition prevention with Durable Objects coordination
- Always handle database errors gracefully
- **WebSocket State Management**: Use Durable Objects for stateful real-time connections
- **Event Broadcasting**: Integrate database operations with WebSocket event distribution
- **Soft Delete Pattern**: Use `deletedAt` column instead of hard delete for core entities (teams, agents, customers, conversations, messages, tags)
- **Channel Integrations**: Use JSON columns (`config`, `credentials`, `webhookConfig`, `stats`) for platform-specific data - no schema changes needed for new platforms
- **Sensitive Data**: Credentials stored in `credentials` JSON column are encrypted using AES-256-GCM via `encryption-service.ts`

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

### **Enterprise Customer Support System**
- **Multi-channel Integration**: Complete LINE OA webhook integration with planned Facebook Messenger support
- **Real-time Communication**: **100% WebSocket** for live message updates with Durable Objects architecture
- **Simplified Role Architecture**: 2-tier role system (Admin/Agent) for streamlined permission management
- **Type-safe Development**: Full TypeScript implementation with strict mode and comprehensive testing
- **Scalable Infrastructure**: Production WebSocket infrastructure with five Durable Objects classes

### **Advanced Messaging Features**
- **Complete Messaging System**: 17 production-ready endpoints with 100% functional coverage
- **Bulk Operations**: Batch create/delete up to 100 messages per request with transaction support
- **Attachment Management**: Full R2 integration with upload progress, multi-file support, and 10MB limit
- **Message Forwarding**: Forward messages to up to 20 conversations with custom comments
- **Tagging System**: Flexible tagging with statistics tracking and up to 10 tags per message
- **Data Export**: Export to JSON/CSV formats with advanced filtering (1-1000 records)
- **Delayed Messaging**: 1-120 second delay capabilities with Cloudflare Queues
- **Message Recall**: Full recall functionality with comprehensive testing (43+ test scenarios)
- **Real-time Updates**: **WebSocket-based** live message delivery, status updates, and presence

### **Enterprise Team Management**
- **2-Tier Role System**: Admin and Agent roles with simplified permission hierarchy
- **Team Organization**: Complete team lifecycle management with admin oversight
- **Role-Based Access Control**: Database-level permission enforcement and team-scoped access
- **User Management**: JWT authentication with KV-based session management
- **Activity Tracking**: Comprehensive logging and monitoring of team activities
- **Note**: Team functionality preserved - agents can still be assigned to teams

### **Customer Management**
- **Multi-platform Customer Data**: Unified customer profiles across LINE OA and planned channels
- **Conversation History**: Complete conversation tracking and searchable history
- **Customer Insights**: Data collection and management with privacy-conscious design
- **Tag Management System**:
  - Complete CRUD operations for customer and conversation tags
  - Bulk operations support for efficient tag management
  - Usage statistics and analytics tracking
  - Professional UI with confirmation dialogs and toast notifications
- **Integration Ready**: Webhook handlers prepared for multiple messaging platforms

### **Technical Excellence**
- **Modern Vue 3 Frontend**: Composition API, Pinia stores, and comprehensive testing (132+ tests)
- **Cloudflare Workers Backend**: Edge computing with Hono framework and Drizzle ORM
- **Production Ready**: Complete CI/CD pipeline with health monitoring and deployment verification
- **Performance Optimized**: Virtual scrolling, lazy loading, and efficient data management
- **Developer Experience**: Hot reload, TypeScript support, and comprehensive documentation

## Quick Start for Development

> ⚠️ **IMPORTANT**: This project connects to **REMOTE PRODUCTION RESOURCES**. All database and storage operations affect production data.

1. **Prerequisites**: Node.js 18+, npm, and Cloudflare account with Wrangler CLI
2. **Install Dependencies**:
   ```bash
   npm install
   cd frontend && npm install
   ```
3. **Environment Setup**: Configure `.env` from `.env.example` template with Cloudflare credentials
4. **Verify Remote Connection**:
   ```bash
   npm run health:check:all  # Verify connection to production
   npm run db:studio         # Open Drizzle Studio for REMOTE DB
   ```
5. **Start Development**:
   ```bash
   # Terminal 1 - Backend (connects to REMOTE resources)
   npm run dev               # Wrangler dev with REMOTE D1, KV, R2

   # Terminal 2 - Frontend
   cd frontend && npm run dev # Vite dev server on localhost:3000
   ```
6. **Verify Setup**: `npm run test:api` and `cd frontend && npm run test`

## Production Deployment

### ⚠️ Deployment Environment Policy

**THIS PROJECT USES REMOTE PRODUCTION RESOURCES ONLY**

- **No Local Resources**: This project does NOT use local D1, KV, or R2 resources
- **Development**: Use `npm run dev` which connects to REMOTE production resources
- **Production Deployment**: Use `wrangler deploy` or `npm run deploy` to deploy to production
- **No Staging Environment**: All testing uses production resources, deploys directly to production
- **Environment Configuration**: See `wrangler.toml` - all config is for production only

**Important**: DO NOT add `[env.development]` or `[env.staging]` sections to `wrangler.toml`. The default configuration IS the production configuration. All development operations affect production data.

### Production Infrastructure

The system is production-ready and deployed on Cloudflare infrastructure:
- **Automated deployment** with Wrangler for Workers and Pages
- **Zero-downtime deployments** with Cloudflare's edge network
- **Global distribution** with automatic scaling based on traffic
- **Health monitoring** via `/api/system/health` and `/api/websocket/health` endpoints
- **Database migrations** automated through Drizzle with rollback capabilities
- **File storage** via Cloudflare R2 with CDN integration
- **Domain management** with custom domain support and SSL certificates

## Troubleshooting

### Common Issues
- **TypeScript errors**: Run `npm run type-check` in both root and frontend
- **Test failures**: Check test environment setup in `frontend/vitest.setup.ts`
- **Database issues**: Use `npm run db:studio` to inspect REMOTE data
- **API connectivity**: Verify Cloudflare credentials and run `npm run health:check:all`
- **Connection errors**: Ensure `wrangler` is authenticated with `wrangler login`

### Performance Optimization
- **Virtual scrolling** with @tanstack/vue-virtual for large conversation lists
- **Lazy loading** for route components and heavy imports
- **Code splitting** with Vite for optimal bundle sizes
- **Cloudflare KV caching** for session data and frequently accessed content
- **Database optimization** with Drizzle ORM and efficient query patterns
- **Real-time monitoring** via WebSocket performance metrics and health checks
- **Memory management** with proper cleanup and garbage collection
- **Edge computing** leverage with Cloudflare Workers global distribution
- **Durable Objects** for stateful WebSocket connections with automatic failover

## Enterprise Documentation

### Role System Documentation
- **Role system simplified**: From 3-tier (admin/team/agent) to 2-tier (admin/agent)
- `drizzle/0017_remove_team_role.sql` - Database migration removing team role
- Team functionality preserved - agents can still be organized into teams
- Permission matrix and management guides updated for simplified hierarchy

### Key Documentation Files
- Role hierarchy and permission system
- Team management and assignment workflows
- Migration guide for existing installations
- API access control and security considerations
- Frontend role-based UI implementation

### Messaging Module Documentation
- `docs/api/MESSAGING_API_REFERENCE.md` - Complete API documentation for all 17 messaging endpoints
- `docs/reports/modules/MESSAGING_MODULE_ENHANCEMENT_REPORT.md` - Implementation report with metrics and test status
- Full endpoint coverage: health checks, CRUD, bulk operations, attachments, forwarding, tagging, export

### CORS Configuration Documentation
- `docs/CORS_CONFIGURATION_GUIDE.md` - **Complete CORS configuration guide**
  - Unified CORS architecture explanation
  - How to add new allowed domains
  - WebSocket-specific CORS handling
  - CORS monitoring and analytics
  - Troubleshooting guide
  - Best practices for cross-origin requests
- `src/config/cors.ts` - Single source of truth for all CORS configuration
- `src/handlers/cors-monitoring.ts` - CORS monitoring API endpoints (admin-only)

**Key Features:**
- **Unified Configuration**: All CORS settings in one file (`src/config/cors.ts`)
- **85% Code Reduction**: Eliminated 121 lines of duplicate CORS code across 8 files
- **Full Monitoring**: Built-in error tracking and analytics via `/api/monitoring/cors/*`
- **Credentials Support**: Complete support for authenticated cross-origin requests
- **WebSocket Optimized**: Special handling for WebSocket upgrade requests and authentication

## System Maturity

This is a comprehensive, production-ready system with **enterprise-grade architecture** featuring:

### **Production-Ready Implementation**
- **Full TypeScript** implementation with strict mode and comprehensive type coverage
- **132+ comprehensive tests** with Vitest ensuring code quality and reliability
- **100% WebSocket real-time communication** with Durable Objects architecture for production-scale stateful connections
- **Enterprise deployment** on Cloudflare Workers and Pages with global distribution
- **Database optimization** with Drizzle ORM and D1 for scalable data management

### **Enterprise-Grade Features**
- **3-Role hierarchy system** with Admin, Team, and Agent permissions
- **Team-based organization** with complete lifecycle management and delegation
- **Multi-channel support** with LINE OA integration and planned platform expansion
- **Comprehensive security** with JWT authentication, KV session management, and role-based access control
- **File management system** with R2 integration and upload progress tracking

### **Developer Excellence**
- **Modern development stack** with Vue 3, Composition API, and Pinia state management
- **Hot reload development** with Vite and efficient build processes
- **Code quality enforcement** with ESLint, TypeScript, and automated testing
- **Comprehensive documentation** with clear setup guides and API references
- **CI/CD pipeline** with automated deployment and health monitoring

### **Scalable Architecture**
- **Edge computing** with Cloudflare Workers for global performance
- **Production-scale WebSocket infrastructure** with five Durable Objects classes handling stateful connections
- **Performance optimized** with virtual scrolling, lazy loading, and efficient data patterns
- **Monitoring ready** with health checks, WebSocket performance metrics, and deployment verification

**Production Status**: **Enterprise-ready with comprehensive feature set and prepared for scaling**

---

## 🚀 Web Installer (Self-Hosted Deployment System)

**Location:** `web-installer/`
**Status:** ✅ Production-Ready (Completed 2025-01-28)
**Purpose:** Enable customers to deploy the CRM system to their own Cloudflare accounts with zero technical knowledge

### Quick Overview

**One-Click Deployment System** transforming complex manual deployment into 3-minute automated solution:
- **OAuth Authentication** with Cloudflare
- **Automated Provisioning** of all resources (D1, KV, R2, Queue, Worker, Pages)
- **15-Step Pipeline** with real-time progress updates
- **Production-Ready** with 28 passing tests (90.6% coverage)
- **Cost Transparent**: Starts at $0/month on Cloudflare Free tier

**Key Resources Created:**
- D1 Database (5GB free)
- KV Namespaces x2 (100k reads/day free)
- R2 Bucket (10GB free)
- Queue (delayed messages)
- Worker (100k requests/day free)
- Pages (unlimited free)
- 26+ Database Tables

📖 **Detailed Guide:** See [`docs/claude/WEB_INSTALLER.md`](docs/claude/WEB_INSTALLER.md) for complete architecture, deployment flow, documentation, security features, and cost estimation.

---

## 📚 Extended Documentation

For detailed information on specific topics, see:

- **[Documentation Index](docs/claude/INDEX.md)** - Complete navigation guide
- **[Environment Configuration](docs/claude/ENVIRONMENT_CONFIG.md)** - 3-layer architecture, all env vars, switching guide
- **[Testing Strategy](docs/claude/TESTING.md)** - Complete testing infrastructure and best practices
- **[Route Registration](docs/claude/ROUTE_REGISTRATION.md)** - Critical routing order rules and debugging
- **[Web Installer](docs/claude/WEB_INSTALLER.md)** - Self-hosted deployment system documentation
- **[Hardcoding Best Practices](docs/HARDCODING_BEST_PRACTICES.md)** - Constants management and coding standards

---

- APIAPI
- Always think hard.
- localremote
- Always check chrome-devtools docs to make sure it is up-to-date when needed for implementing new libraries or frameworks, or adding features using them.
- If you find file content exceeds maximum allowed tokens (25000), please use offset and limit parameters to read specific portions of the file, or use the GrepTool to search for specific content.
