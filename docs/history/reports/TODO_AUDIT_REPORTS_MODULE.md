# TODO Audit: Reports Module

> **Audit Date**: 2026-01-30
> **Auditor**: Claude Code
> **Module**: `src/modules/reports/`

---

##  Summary

```
┌────────────────────────────────────────────────────────┐
│  TODO Distribution in Reports Module │
├────────────────────────────────────────────────────────┤
│  reports-service.ts ████████████████████  24個  │
│  reports-validation.ts █                      1個  │
│  sample-data-generators.ts 0個  │
│ │
│  Total: 25 TODOs │
└────────────────────────────────────────────────────────┘
```

---

##  CRITICAL Priority (6 items) - Database Persistence

These TODOs are essential for production readiness. The current implementation uses mock data.

| Line | Location | Description | Estimated Effort |
|------|----------|-------------|------------------|
| 1021 | `reports-service.ts` | 儲存到資料庫 (Save to database) | 2-3 hours |
| 1040 | `reports-service.ts` | 從資料庫獲取現有報告 (Get existing reports from DB) | 2-3 hours |
| 1065 | `reports-service.ts` | 更新到資料庫 (Update to database) | 1-2 hours |
| 1080 | `reports-service.ts` | 檢查權限和刪除 (Check permissions and delete) | 2-3 hours |
| 1093 | `reports-service.ts` | 從資料庫查詢 (Query from database) | 2-3 hours |
| 805 | `reports-service.ts` | 從資料庫刪除 (Delete from database) | 1-2 hours |

**Impact**: Without these, reports cannot be persisted. All generated reports are lost on service restart.

**Recommended Approach**:
1. Create `reports` table in D1 schema
2. Implement CRUD operations with Drizzle ORM
3. Add foreign key relationships to `agents` and `teams`

---

##  HIGH Priority (8 items) - Data Query Logic

These TODOs relate to actual data aggregation from the database instead of using sample data.

| Line | Location | Description | Dependencies |
|------|----------|-------------|--------------|
| 367 | `reports-service.ts` | 實作平均響應時間計算 | messages table |
| 368 | `reports-service.ts` | 實作平均解決時間計算 | conversations table |
| 369 | `reports-service.ts` | 從 conversations 表中計算平台分布 | conversations table |
| 370 | `reports-service.ts` | 從 conversations 表中計算優先級分布 | conversations table |
| 371 | `reports-service.ts` | 從 conversations 表中計算團隊分布 | conversations, teams tables |
| 447 | `reports-service.ts` | 計算實際活躍客服數 | agents table |
| 457-459 | `reports-service.ts` | 計算解決率、工作時數、效率 | agents, conversations tables |
| 831 | `reports-service.ts` | 實現真實統計查詢 | All tables |

**Impact**: Reports currently return sample data. Production requires real database queries.

**Recommended Approach**:
1. Design efficient SQL queries for aggregation
2. Implement caching layer for performance
3. Add date range filtering

---

##  MEDIUM Priority (10 items) - Feature Enhancement

| Line | Location | Description | Category |
|------|----------|-------------|----------|
| 955 | `reports-service.ts` | 實現重新生成 (Implement regeneration) | Actions |
| 964 | `reports-service.ts` | 實現匯出功能 (Implement export) | Export |
| 1241 | `reports-service.ts` | 實現權限檢查 (Implement permission check) | Security |
| 1247 | `reports-service.ts` | 檢查並發生成限制 (Check concurrent generation limit) | Rate Limiting |
| 1251 | `reports-service.ts` | 檢查下載權限 (Check download permission) | Security |
| 1258 | `reports-service.ts` | 檢查刪除權限 (Check delete permission) | Security |
| 1265 | `reports-service.ts` | 啟動後台生成任務 (Start background generation task) | Async |
| 1296 | `reports-service.ts` | 刪除 R2 存儲的檔案 (Delete R2 stored files) | Storage |

**Impact**: Missing features that affect user experience but don't block core functionality.

---

##  LOW Priority (1 item) - Validation Enhancement

| Line | Location | Description |
|------|----------|-------------|
| 113 | `reports-validation.ts` | 實現速率限制邏輯 (Implement rate limiting logic) |

**Impact**: Nice-to-have security feature.

---

##  Implementation Roadmap (Suggested)

```
Timeline Visualization:

Phase A: Database Persistence (CRITICAL)
┌──────────────────────────────────────────┐
│ Week 1-2: Schema + CRUD Operations │
│ ████████████████████████████████████████ │
└──────────────────────────────────────────┘
Deliverables:
- reports table schema
- ReportsRepository class
- Unit tests for persistence

Phase B: Data Query Logic (HIGH)
┌──────────────────────────────────────────┐
│ Week 3-4: Real Data Aggregation │
│ ████████████████████████████████████████ │
└──────────────────────────────────────────┘
Deliverables:
- SQL aggregation queries
- Caching layer with KV
- Performance optimization

Phase C: Feature Enhancement (MEDIUM)
┌──────────────────────────────────────────┐
│ Week 5-6: Export, Permissions, Background│
│ ████████████████████████████████████████ │
└──────────────────────────────────────────┘
Deliverables:
- Export to CSV/JSON/PDF
- RBAC integration
- Background job processing

Phase D: Validation (LOW)
┌────────────┐
│ Week 7 │
│ ████████ │
└────────────┘
Deliverables:
- Rate limiting middleware
```

---

##  Detailed TODO Listing

### File: `src/modules/reports/services/reports-service.ts`

```typescript
// Line 367-371: Conversation Summary Data Calculation
averageResponseTime: 0, // TODO: 實作平均響應時間計算
averageResolutionTime: 0, // TODO: 實作平均解決時間計算
conversationsByPlatform: {}, // TODO: 從 conversations 表中計算
conversationsByPriority: {}, // TODO: 從 conversations 表中計算
conversationsByTeam: {}, // TODO: 從 conversations 表中計算

// Line 447-459: Agent Performance Metrics
activeAgents: agentPerformance.length, // TODO: 計算實際活躍客服數
resolutionRate: 0, // TODO: 計算解決率
activeHours: 0, // TODO: 計算工作時數
efficiency: 0 // TODO: 計算效率

// Line 805: Schedule Deletion
// TODO: 從資料庫刪除

// Line 831: Statistics Query
// TODO: 實現真實統計查詢

// Line 955-964: Report Actions
// TODO: 實現重新生成
// TODO: 實現匯出功能

// Line 1021-1093: Report CRUD Operations
// TODO: 儲存到資料庫
// TODO: 從資料庫獲取現有報告
// TODO: 更新到資料庫
// TODO: 檢查權限和刪除
// TODO: 從資料庫查詢

// Line 1241-1296: Permission and Resource Management
// TODO: 實現權限檢查
// TODO: 檢查並發生成限制
// TODO: 檢查下載權限
// TODO: 檢查刪除權限
// TODO: 啟動後台生成任務
// TODO: 刪除 R2 存儲的檔案
```

### File: `src/modules/reports/middleware/reports-validation.ts`

```typescript
// Line 113: Rate Limiting
// TODO: 實現速率限制邏輯
```

---

##  Verification Commands

```bash
# Search for TODOs in reports module
grep -rn "TODO" src/modules/reports/

# Count TODOs by file
grep -rn "TODO" src/modules/reports/ | cut -d: -f1 | sort | uniq -c

# Verify no TODOs in sample-data-generators.ts
grep -c "TODO" src/modules/reports/services/sample-data-generators.ts
# Expected: 0
```

---

##  Test Coverage Status

After Phase 2 implementation:

| Component | Tests | Status |
|-----------|-------|--------|
| `sample-data-generators.ts` | 114 |  100% Pass |
| `reports-service.ts` | TBD |  Needs Tests |
| `reports-validation.ts` | TBD |  Needs Tests |

---

##  Success Criteria for TODO Completion

### Phase A (Database Persistence)
- [ ] Reports can be saved to D1 database
- [ ] Reports can be retrieved by ID
- [ ] Reports can be listed with pagination
- [ ] Reports can be updated
- [ ] Reports can be soft-deleted
- [ ] All operations have audit logging

### Phase B (Data Query Logic)
- [ ] Real conversation metrics from database
- [ ] Real agent performance from database
- [ ] Caching reduces DB queries by 80%
- [ ] Query performance < 500ms for 30-day range

### Phase C (Feature Enhancement)
- [ ] Export to CSV works for all report types
- [ ] Export to JSON preserves full data structure
- [ ] Permission checks prevent unauthorized access
- [ ] Background generation handles large reports

### Phase D (Validation)
- [ ] Rate limiting prevents abuse
- [ ] Clear error messages for rate limit violations

---

*Document generated as part of Phase 2: Unit Tests & TODO Audit*
