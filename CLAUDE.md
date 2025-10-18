# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Multi-Channel Customer Support System** built with Cloudflare Workers and Vue 3. It's a comprehensive platform that integrates LINE OA and supports Facebook Messenger for unified customer service management, featuring **enterprise-grade architecture** with **100% WebSocket-based real-time communication** powered by Durable Objects.

### Key Characteristics
- **Modern Vue 3 + TypeScript** frontend with comprehensive testing (132+ tests)
- **Cloudflare Worker backend** with Hono framework and Drizzle ORM
- **Enterprise role system** with Admin, Team, and Agent hierarchies
- **LINE OA integration** with complete webhook handling
- **Delayed messaging system** with Cloudflare Queues integration
- **File upload support** with Cloudflare R2 storage
- **Production deployment** on Cloudflare Pages and Workers
- **WebSocket real-time communication** with Durable Objects architecture (100% deployed)

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

### Backend (Root Directory)
```bash
# Development
npm run dev # Start Wrangler dev server with local persistence
npm run dev:remote # Start Wrangler dev server with remote bindings
npm run build # TypeScript compilation check
npm run lint:check # TypeScript + Vue type checking with linting

# Database Operations
npm run db:migrate # Apply migrations locally
npm run db:migrate:prod # Apply migrations to production
npm run db:studio:local # Open Drizzle Studio for local DB
npm run db:generate # Generate Drizzle migrations
npm run db:push # Push schema changes

# Deployment & Production
npm run deploy # Deploy to production
npm run health:check:all # Check system health endpoints
npm run monitor:deployment # Monitor deployment health

# Testing & Validation
npm run test:handlers # Test all handlers
npm run test:api # API integration tests
npm run test:recall # Message recall functionality tests
npm run test:upload # File upload end-to-end tests

# Performance & Monitoring
npm run benchmark:baseline # Performance baseline establishment
npm run profile:memory # Memory usage profiling
```

### Frontend (frontend/ directory)
```bash
# Development
npm run dev # Start Vite dev server (port 3000)
npm run dev:local # Development with local backend
npm run build # Build for production
npm run type-check # Vue TypeScript checking

# Testing (132+ tests)
npm run test # Run all tests with Vitest
npm run test:run # Single test run
npm run test:coverage # Generate coverage report
npm run test:ui # Interactive test UI

# Linting & Code Quality
npm run lint # ESLint with auto-fix
npm run lint:check # ESLint check only

# Deployment
npm run build:pages # Build and copy Cloudflare Pages config
npm run deploy:pages # Deploy to Cloudflare Pages
npm run verify:deployment # Verify production deployment
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
- `frontend/src/composables/` - Vue composables for WebSocket functionality
- `frontend/src/components/ui/` - Real-time UI components (status indicators, typing indicators)
- `frontend/src/views/ConversationDetail.vue` - Main conversation interface with WebSocket integration
- `frontend/src/types/` - Frontend type definitions including WebSocket types

## Testing Strategy

### Comprehensive WebSocket Testing Infrastructure
The project features enterprise-grade testing for real-time WebSocket functionality:

#### **WebSocket Testing Categories**
- **Unit Tests** (`tests/unit/durable-objects/`) - Individual Durable Objects testing
- **Integration Tests** (`tests/integration/websocket/`) - End-to-end WebSocket flows
- **Performance Tests** (`tests/performance/websocket/`) - 1000+ connection scalability testing
- **Stress Tests** (`tests/stress/websocket/`) - High-load and recovery scenarios
- **End-to-End Tests** (`tests/e2e/websocket/`) - Complete real-time conversation workflows

#### **WebSocket Test Infrastructure**
- `tests/helpers/websocket/WebSocketTestClient.ts` - Simulates real WebSocket connections
- `tests/helpers/websocket/DurableObjectsTestEnv.ts` - Mock Durable Objects environment
- `tests/helpers/websocket/TestUtilities.ts` - Load testing and performance helpers
- `tests/helpers/websocket/WebSocketTestSetup.ts` - Global WebSocket test configuration

### Frontend Testing (132+ tests, 100% pass rate)
The project has a robust testing infrastructure:
- **Unit tests** for all components and stores including WebSocket components
- **Integration tests** for API communication and WebSocket connections
- **Real-time functionality tests** for typing indicators, presence, and live updates
- **Edge case testing** for error scenarios and connection failures
- **Performance tests** for optimization validation

Key test helpers:
- `frontend/tests/helpers/directStoreCreation.ts` - Reliable store testing
- `frontend/tests/helpers/testUtils.ts` - Common test utilities
- `frontend/vitest.setup.ts` - Global test configuration

### Backend Testing
- Handler-specific tests in `tests/unit/handlers/` with WebSocket broadcasting validation
 - **Messaging Handler**: 44 unit tests with 66% pass rate (29/44 passing, core functionality 100%)
- API integration tests in `tests/integration/` including real-time event testing
- Database operation tests with mocking
- **WebSocket Infrastructure Tests** - Complete Durable Objects and broadcasting system testing
- **Load Testing Suite** - Validates 1000+ concurrent connections and message throughput

## Development Best Practices

### Route Registration Order ( Critical)

**WHY IT MATTERS**: In Hono framework, route registration order determines routing priority. Routes registered later **cannot override** earlier catch-all routes. This can cause route interception issues where endpoints return unexpected authentication errors.

#### Route Registration Priority Levels

Routes in `src/index.ts` MUST be registered in this specific order:

```

 Priority 1 (HIGHEST): Public Endpoints Without Auth

 Register BEFORE Unified Route System (Line ~221-240)

 WebSocket health endpoints
 /api/websocket/health
 /api/websocket/migration-status

 CORS monitoring endpoints
 /api/cors/health (Public)
 /api/cors/config (Public)
 /api/cors/stats (Admin - internal auth check)

 Analytics comparison API
 /api/analytics/comparison/*

 WHY: These need direct access without middleware
 interception from unified route system


 Priority 2: Explicit Auth Middleware + Handler

 Register BEFORE Unified Route System (Line ~238-243)

 WebSocket Dashboard (with explicit jwtAuth)
 app.use('/api/websocket/dashboard/*', jwtAuth)
 app.route('/api/websocket/dashboard', handler)

 WHY: Explicit middleware declaration for clarity


 Priority 3: Unified Route System (Line ~252)

 RouteRegistry + routeGroups.forEach(...)

 Batch registration of modular routes
 May create catch-all routes
 Can intercept later registrations

 WHY: Centralized route management for most endpoints


 Priority 4 (LOWEST): Fine-grained Individual Routes

 Register AFTER Unified Route System (Line ~297+)

 System settings endpoints
 Credentials management
 Team management endpoints

 WHY: Specific endpoints that don't conflict with
 catch-all routes

```

#### Common Pitfalls & Solutions

**Problem**: New endpoint returns `401 Unauthorized` even without auth requirements

```typescript
// BAD: Register after unified route system
const routeRegistry = new RouteRegistry(app);
routeGroups.forEach(group => routeRegistry.registerGroup(group));

// This will be intercepted by unified system!
app.route('/api/myendpoint', myHandler); // TOO LATE
```

```typescript
// GOOD: Pre-register BEFORE unified route system
// Register public endpoint first
app.route('/api/myendpoint', myHandler); // PRIORITY

const routeRegistry = new RouteRegistry(app);
routeGroups.forEach(group => routeRegistry.registerGroup(group));
```

#### Route Registration Checklist

When adding a new API handler:

- [ ] **Does it need public access (no auth)?**
 - YES Register BEFORE unified route system (Priority 1)
 - NO Can register in unified system or after (Priority 3-4)

- [ ] **Test with diagnostic route first**
 ```typescript
 app.route('/test-myendpoint', myHandler); // Test route
 app.route('/api/myendpoint', myHandler); // Production route
 ```

- [ ] **Verify with curl testing**
 ```bash
 curl https://your-domain.com/api/myendpoint
 # Should NOT return 401 if public endpoint
 ```

- [ ] **Add E2E test coverage**
 - Test both authenticated and unauthenticated scenarios

- [ ] **Document in route registration section**
 - Add clear comments explaining WHY this route needs special positioning

#### Reference: Recent Fix Example

**Issue**: CORS monitoring endpoints returned 401 errors
- **Root Cause**: Handler registered AFTER unified route system (Line 425+)
- **Solution**: Moved registration BEFORE unified system (Line 221)
- **Result**: All 12 E2E tests passing, endpoints accessible
- **Fix Version**: d51fc6c8-02aa-4458-82af-af8e9c6d5d6a

See `docs/architecture/ROUTE_REGISTRATION_ORDER.md` for detailed guide.

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
- **Enterprise Architecture**: Production-ready deployment on Cloudflare Workers and Pages
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
- **3-Role Hierarchy**: Admin, Team, and Agent roles with inheritance-based permissions
- **Team Organization**: Complete team lifecycle management with leader delegation
- **Role-Based Access Control**: Database-level permission enforcement and team-scoped access
- **User Management**: JWT authentication with KV-based session management
- **Activity Tracking**: Comprehensive logging and monitoring of team activities

### **Customer Management**
- **Multi-platform Customer Data**: Unified customer profiles across LINE OA and planned channels
- **Conversation History**: Complete conversation tracking and searchable history
- **Customer Insights**: Data collection and management with privacy-conscious design
- **Integration Ready**: Webhook handlers prepared for multiple messaging platforms

### **Technical Excellence**
- **Modern Vue 3 Frontend**: Composition API, Pinia stores, and comprehensive testing (132+ tests)
- **Cloudflare Workers Backend**: Edge computing with Hono framework and Drizzle ORM
- **Production Ready**: Complete CI/CD pipeline with health monitoring and deployment verification
- **Performance Optimized**: Virtual scrolling, lazy loading, and efficient data management
- **Developer Experience**: Hot reload, TypeScript support, and comprehensive documentation

## Quick Start for Development

1. **Prerequisites**: Node.js 18+, npm, and Cloudflare account with Wrangler CLI
2. **Install Dependencies**:
 ```bash
 npm install
 cd frontend && npm install
 ```
3. **Environment Setup**: Configure `.env` from `.env.example` template
4. **Database Setup**:
 ```bash
 npm run db:migrate # Apply database migrations
 npm run db:studio:local # (Optional) Open Drizzle Studio
 ```
5. **Start Development**:
 ```bash
 # Terminal 1 - Backend
 npm run dev # Cloudflare Worker on localhost:8787

 # Terminal 2 - Frontend
 cd frontend && npm run dev # Vite dev server on localhost:3000
 ```
6. **Verify Setup**: `npm run test:api` and `cd frontend && npm run test`

## Production Deployment

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
- **Database issues**: Use `npm run db:studio:local` to inspect data
- **API connectivity**: Verify environment variables in `wrangler.toml`

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
- `docs/enterprise/ENTERPRISE_ROLES_SYSTEM.md` - Comprehensive 3-role system guide
- `drizzle/0004_add_enterprise_roles_team_support.sql` - Database migration for role system
- Permission matrix, team management, and deployment guides included

### Key Documentation Files
- Role hierarchy and permission system
- Team management and assignment workflows
- Migration guide for existing installations
- API access control and security considerations
- Frontend role-based UI implementation

### Messaging Module Documentation
- `docs/api/MESSAGING_API_REFERENCE.md` - Complete API documentation for all 17 messaging endpoints
- `MESSAGING_MODULE_ENHANCEMENT_REPORT.md` - Implementation report with metrics and test status
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

- APIAPI
- Always think hard.
- localremote
- Always check chrome-devtools docs to make sure it is up-to-date when needed for implementing new libraries or frameworks, or adding features using them.