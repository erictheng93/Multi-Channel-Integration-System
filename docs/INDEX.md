# 📚 Documentation Index

> Multi-Channel Customer Support System - Documentation Navigation

---

## 🗂️ Directory Structure Overview

```
docs/
├── reference/          # API 參考文檔、規格書、編碼標準
├── guides/             # 用戶指南、部署指南、故障排除
├── architecture/       # 系統架構設計、WebSocket、資料庫
├── development/        # 開發者文檔、測試、組件
├── claude/             # Claude Code 專用參考文檔
└── history/            # 歷史記錄、實現報告、遷移記錄
```

---

## 📖 Reference (`reference/`)

### API Reference (`reference/api/`)
- [API Reference](reference/api/API_REFERENCE.md) - Complete API reference documentation
- [Messaging API](reference/api/MESSAGING_API_REFERENCE.md) - Messaging endpoints (17 endpoints)
- [Tag API](reference/api/TAG_API_REFERENCE.md) - Tag management API

#### API Modules (`reference/api/modules/`)
- [Analytics API](reference/api/modules/ANALYTICS_API.md) - Analytics and reporting
- [Collaboration API](reference/api/modules/COLLABORATION_API.md) - Team collaboration
- [WebSocket API](reference/api/modules/WEBSOCKET_API.md) - Real-time communication

### Specifications (`reference/specifications/`)
- [BRD](reference/specifications/BRD.md) - Business Requirements Document
- [FRS](reference/specifications/FRS.md) - Functional Requirements Specification
- [NFR](reference/specifications/NFR.md) - Non-Functional Requirements
- [SRS](reference/specifications/SRS.md) - System Requirements Specification

### Standards (`reference/standards/`)
- Coding standards and best practices

---

## 📘 Guides (`guides/`)

### Deployment (`guides/deployment/`)
- [Deployment Guide](guides/deployment/DEPLOYMENT_GUIDE.md) - Production deployment
- [Customer Deployment](guides/deployment/CUSTOMER_DEPLOYMENT_GUIDE.md) - Customer setup
- [Web Installer](guides/deployment/WEB_INSTALLER_DOCUMENTATION.md) - Self-hosted deployment

### Features (`guides/features/`)
- Feature usage guides and tutorials

### Troubleshooting (`guides/troubleshooting/`)
- [Debug LINE Webhook](guides/troubleshooting/debug-line-webhook.md) - LINE webhook debugging
- Problem resolution guides

### General Guides
- [BUN Migration Guide](guides/BUN_MIGRATION_GUIDE.md) - Bun runtime migration
- [CORS Configuration](guides/CORS_CONFIGURATION_GUIDE.md) - CORS setup guide
- [KV Best Practices](guides/KV_BEST_PRACTICES.md) - Cloudflare KV optimization
- [Team Management Guide](guides/TEAM_MANAGEMENT_GUIDE.md) - Team management features

---

## 🏗️ Architecture (`architecture/`)

### WebSocket (`architecture/websocket/`)
- [WebSocket Final Architecture](architecture/websocket/WEBSOCKET_FINAL_ARCHITECTURE.md) - Complete WebSocket design
- [Durable Objects Complete](architecture/websocket/DURABLE_OBJECTS_COMPLETE.md) - DO implementation

### Database (`architecture/database/`)
- Database design and migrations

### Security (`architecture/security/`)
- Security architecture and implementation

### Performance (`architecture/performance/`)
- Performance optimization guides

### General Architecture
- [Schema](architecture/SCHEMA.md) - Database schema reference
- [Module Dependency](architecture/MODULE_DEPENDENCY_DIAGRAM.md) - Module relationships
- [Hardcoding Best Practices](architecture/HARDCODING_BEST_PRACTICES.md) - Constants management

---

## 💻 Development (`development/`)

### Testing (`development/testing/`)
- [Testing Guide](development/testing/testing-guide.md) - Testing methodology
- [WebSocket Testing](development/testing/WEBSOCKET_TESTING_GUIDE.md) - WebSocket test infrastructure
- [Frontend Test Report](development/testing/FRONTEND_TEST_COMPLETION_REPORT.md) - Frontend test coverage

### Components (`development/components/`)
- Component documentation and usage

### Tools (`development/tools/`)
- Development tools and utilities

### Frontend (`development/frontend/`)
- Frontend-specific development guides

### Analytics (`development/analytics/`)
- Analytics implementation guides

### Monitoring (`development/monitoring/`)
- API monitoring and observability

---

## 🤖 Claude Code (`claude/`)

- [INDEX](claude/INDEX.md) - Claude Code documentation index
- [Environment Config](claude/ENVIRONMENT_CONFIG.md) - Environment configuration guide
- [Testing](claude/TESTING.md) - Testing strategy and infrastructure
- [Route Registration](claude/ROUTE_REGISTRATION.md) - Route registration rules
- [Web Installer](claude/WEB_INSTALLER.md) - Web installer documentation
- [Team Management](claude/TEAM_MANAGEMENT.md) - Team management architecture

---

## 📜 History (`history/`)

> Archived documentation including implementation reports, migration records, and historical references.

### Implementation (`history/implementation/`)
- Historical implementation reports

### Migration (`history/migration/`)
- Migration records and changelogs

### Refactoring (`history/refactoring/`)
- Refactoring plans and summaries

### Reports (`history/reports/`)
- Analysis reports, feature reports, security audits

### Fixes (`history/fixes/`)
- Bug fix documentation

---

## 🚀 Quick Start

### For New Developers
1. Read [CLAUDE.md](../CLAUDE.md) - Project overview
2. Review [Environment Config](claude/ENVIRONMENT_CONFIG.md) - Setup guide
3. Check [Testing Guide](development/testing/testing-guide.md) - Testing methodology

### For Deployment
1. Review [Deployment Guide](guides/deployment/DEPLOYMENT_GUIDE.md)
2. Follow [Web Installer](guides/deployment/WEB_INSTALLER_DOCUMENTATION.md) for self-hosted setup

### For API Integration
1. Start with [API Reference](reference/api/API_REFERENCE.md)
2. Review specific module APIs in `reference/api/modules/`

---

## 📊 Documentation Statistics

| Category | Files | Description |
|----------|-------|-------------|
| reference/ | 33 | API docs, specifications, standards |
| guides/ | 104 | User guides, deployment, troubleshooting |
| architecture/ | 40 | System design, WebSocket, database |
| development/ | 83 | Testing, components, tools |
| claude/ | 8 | Claude Code specific docs |
| history/ | 186 | Archived reports and records |

**Total: 458 documents**

---

*Last updated: 2025-01-29*
