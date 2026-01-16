# Claude Code Documentation Index

Welcome to the extended documentation for the Multi-Channel Customer Support System. This directory contains detailed guides extracted from the main CLAUDE.md file for better organization and performance.

## 📋 Quick Navigation

### Core Documentation
- **[CLAUDE.md](../../CLAUDE.md)** - Main project overview and quick reference (⚡ optimized for fast loading)

### Detailed Guides

#### 🔧 **Environment Configuration**
- **File:** [`ENVIRONMENT_CONFIG.md`](ENVIRONMENT_CONFIG.md)
- **Size:** ~6,000 characters
- **Contents:**
  - Complete 3-layer architecture explanation
  - All environment variables (frontend + backend)
  - Configuration functions reference
  - Environment switching guide
  - Best practices and troubleshooting
- **Use When:** Setting up environment, switching between dev/prod, configuring URLs

#### 🧪 **Testing Strategy**
- **File:** [`TESTING.md`](TESTING.md)
- **Size:** ~2,000 characters
- **Contents:**
  - WebSocket testing infrastructure
  - Frontend testing (132+ tests)
  - Backend testing
  - Running tests guide
  - Test best practices
- **Use When:** Writing tests, running test suites, understanding test architecture

#### 🛣️ **Route Registration**
- **File:** [`ROUTE_REGISTRATION.md`](ROUTE_REGISTRATION.md)
- **Size:** ~4,000 characters
- **Contents:**
  - Critical routing order rules
  - Priority levels in src/index.ts
  - Common pitfalls and solutions
  - Registration checklist
  - Debugging tips
- **Use When:** Adding new API endpoints, debugging 401 errors, route conflicts

#### 🚀 **Web Installer**
- **File:** [`WEB_INSTALLER.md`](WEB_INSTALLER.md)
- **Size:** ~5,000 characters
- **Contents:**
  - Complete architecture overview
  - 15-step deployment pipeline
  - Test results and coverage
  - Documentation references
  - Cost estimation
- **Use When:** Understanding web installer, deploying for customers, troubleshooting deployment

#### 👥 **Team Management** (NEW)
- **File:** [`TEAM_MANAGEMENT.md`](TEAM_MANAGEMENT.md)
- **Size:** ~8,000 characters
- **Contents:**
  - Dual role architecture (System + Team roles)
  - Multi-team support with JWT caching
  - Dynamic sorting system with drag-and-drop
  - Team-scoped WebSocket broadcasts
  - Member deletion with FK cleanup
  - Protected API endpoints
- **Use When:** Working on team features, understanding role hierarchy, implementing sorting

## 🔍 Find What You Need

### By Task

**I want to...**

- **Set up my development environment** → [ENVIRONMENT_CONFIG.md](ENVIRONMENT_CONFIG.md) + [CLAUDE.md Quick Start](../../CLAUDE.md#quick-start-for-development)
- **Switch between dev and production** → [ENVIRONMENT_CONFIG.md](ENVIRONMENT_CONFIG.md#environment-switching-guide)
- **Add a new API endpoint** → [ROUTE_REGISTRATION.md](ROUTE_REGISTRATION.md)
- **Write tests for my code** → [TESTING.md](TESTING.md)
- **Understand the Web Installer** → [WEB_INSTALLER.md](WEB_INSTALLER.md)
- **Work on team management features** → [TEAM_MANAGEMENT.md](TEAM_MANAGEMENT.md)
- **Implement sorting/drag-and-drop** → [TEAM_MANAGEMENT.md](TEAM_MANAGEMENT.md#dynamic-sorting-system)
- **Fix CORS issues** → [CLAUDE.md CORS Documentation](../../CLAUDE.md#cors-configuration-documentation)
- **Deploy to production** → [CLAUDE.md Production Deployment](../../CLAUDE.md#production-deployment)

### By Component

**I'm working on...**

- **Frontend (Vue 3)** → [CLAUDE.md Frontend Architecture](../../CLAUDE.md#frontend-vue-3-application)
- **Backend (Cloudflare Workers)** → [CLAUDE.md Backend Architecture](../../CLAUDE.md#backend-cloudflare-worker)
- **Database (D1 + Drizzle)** → [CLAUDE.md Database & ORM](../../CLAUDE.md#database--orm)
- **WebSocket** → [TESTING.md WebSocket Testing](TESTING.md#comprehensive-websocket-testing-infrastructure)
- **Team Management** → [TEAM_MANAGEMENT.md](TEAM_MANAGEMENT.md)
- **Sorting & Drag-Drop** → [TEAM_MANAGEMENT.md](TEAM_MANAGEMENT.md#dynamic-sorting-system)
- **Environment Configuration** → [ENVIRONMENT_CONFIG.md](ENVIRONMENT_CONFIG.md)
- **Testing** → [TESTING.md](TESTING.md)

### By Problem

**I'm getting...**

- **401 Unauthorized errors** → [ROUTE_REGISTRATION.md Common Pitfalls](ROUTE_REGISTRATION.md#common-pitfalls--solutions)
- **CORS errors** → [CLAUDE.md CORS Documentation](../../CLAUDE.md#cors-configuration-documentation)
- **Environment variable errors** → [ENVIRONMENT_CONFIG.md Troubleshooting](ENVIRONMENT_CONFIG.md#troubleshooting-configuration-issues)
- **Test failures** → [TESTING.md](TESTING.md) + [CLAUDE.md Troubleshooting](../../CLAUDE.md#troubleshooting)
- **WebSocket connection issues** → [ENVIRONMENT_CONFIG.md](ENVIRONMENT_CONFIG.md#troubleshooting-configuration-issues)

## 📊 Documentation Statistics

```
Total Documentation Size: ~25,000 characters (split from 48,300)
CLAUDE.md: ~28,000 characters (updated with new features)
Modular Docs: 5 files totaling ~25,000 characters

Files:
├── ENVIRONMENT_CONFIG.md  (~6,000 chars)
├── TESTING.md             (~2,000 chars)
├── ROUTE_REGISTRATION.md  (~4,000 chars)
├── WEB_INSTALLER.md       (~5,000 chars)
└── TEAM_MANAGEMENT.md     (~8,000 chars) [NEW]

Maintainability: 6 focused files for easier navigation
```

## 🎯 Best Practices

1. **Start with CLAUDE.md** - Get the big picture and quick reference
2. **Dive deep when needed** - Open detailed guides for specific topics
3. **Use search** - Each file is focused and searchable
4. **Keep it updated** - When updating docs, maintain both summary in CLAUDE.md and details in modular files

## 🔄 Update Process

When adding new documentation:

1. **Add summary to CLAUDE.md** (2-3 paragraphs max)
2. **Create detailed guide** in `docs/claude/` if >2,000 characters
3. **Add link** from CLAUDE.md to detailed guide
4. **Update this INDEX.md** with new file reference
5. **Test** that all links work

## 📝 Recent Changes

### 2025-01-16: Enterprise Team Management & Sorting System
- ✅ **RBAC Phase 2**: Team role hierarchy (Member → Lead → Supervisor)
- ✅ **Multi-Team Support**: JWT-cached permissions with 50% DB query reduction
- ✅ **Dynamic Sorting**: Field-based sorting with SortDropdown component
- ✅ **Drag-and-Drop**: Custom ordering with localStorage persistence (vue-draggable-plus)
- ✅ **Team-Scoped Broadcasts**: WebSocket security isolation
- ✅ **Member Deletion**: Comprehensive foreign key cleanup
- ✅ **Auto-Assignment Broadcasts**: Real-time UI updates for LINE Follow events
- ✅ **Race Condition Fix**: Resolved empty messages flash in conversation view
- ✅ **Code Quality**: Eliminated all TypeScript unused variable warnings

### 2025-01-31: Modular Documentation Migration
- ✅ Created modular documentation structure
- ✅ Extracted 4 major sections from CLAUDE.md
- ✅ Reduced CLAUDE.md from 48.3k to ~27k characters (44% reduction)
- ✅ Created navigation index (this file)
- ✅ All cross-references verified

## 🆘 Getting Help

- **Documentation Issues**: Check if content is outdated or unclear
- **Technical Issues**: See [CLAUDE.md Troubleshooting](../../CLAUDE.md#troubleshooting)
- **Questions**: Review relevant detailed guide or ask in project discussions

---

**Navigation:** [Back to CLAUDE.md](../../CLAUDE.md) | [Project README](../../README.md)
