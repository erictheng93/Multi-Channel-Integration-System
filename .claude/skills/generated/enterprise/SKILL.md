---
name: enterprise
description: "Skill for the Enterprise area of Multi-Channel-Integration-System. 35 symbols across 7 files."
---

# Enterprise

35 symbols | 7 files | Cohesion: 69%

## When to Use

- Working with code in `src/`
- Understanding how getConversationMetrics, getMessageMetrics, getWorkTimeMetrics work
- Modifying enterprise-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/enterprise/analytics-reports.ts` | validateReportConfig, tagJsonPath, buildDrizzleSelectFields, generateCustomReport, escapeCsvField (+6) |
| `src/enterprise/analytics-agent.ts` | getConversationMetrics, getMessageMetrics, getWorkTimeMetrics, getSatisfactionMetrics, getAgentName |
| `src/enterprise/analytics-dashboard.ts` | getRealTimeMetrics, checkAlerts, getTrendData, getHistoricalData, predictMessageVolume |
| `src/enterprise/analytics.ts` | getAgentPerformanceMetrics, generateDashboardData, getSystemPerformanceMetrics, generatePredictiveAnalytics |
| `src/enterprise/audit-logger.ts` | log, logBusinessOperation, logSystemEvent, auditLogMiddleware |
| `src/enterprise/analytics-system.ts` | getApiMetrics, getDatabaseMetrics, getIntegrationMetrics |
| `src/enterprise/rbac.ts` | checkPermission, checkBasicPermission, rbacMiddleware |

## Entry Points

Start here when exploring this area:

- **`getConversationMetrics`** (Function) — `src/enterprise/analytics-agent.ts:6`
- **`getMessageMetrics`** (Function) — `src/enterprise/analytics-agent.ts:49`
- **`getWorkTimeMetrics`** (Function) — `src/enterprise/analytics-agent.ts:83`
- **`getSatisfactionMetrics`** (Function) — `src/enterprise/analytics-agent.ts:113`
- **`getAgentName`** (Function) — `src/enterprise/analytics-agent.ts:148`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `InvalidReportConfigError` | Class | `src/enterprise/analytics-reports.ts` | 53 |
| `getConversationMetrics` | Function | `src/enterprise/analytics-agent.ts` | 6 |
| `getMessageMetrics` | Function | `src/enterprise/analytics-agent.ts` | 49 |
| `getWorkTimeMetrics` | Function | `src/enterprise/analytics-agent.ts` | 83 |
| `getSatisfactionMetrics` | Function | `src/enterprise/analytics-agent.ts` | 113 |
| `getAgentName` | Function | `src/enterprise/analytics-agent.ts` | 148 |
| `validateReportConfig` | Function | `src/enterprise/analytics-reports.ts` | 97 |
| `buildDrizzleSelectFields` | Function | `src/enterprise/analytics-reports.ts` | 132 |
| `generateCustomReport` | Function | `src/enterprise/analytics-reports.ts` | 226 |
| `escapeCsvField` | Function | `src/enterprise/analytics-reports.ts` | 322 |
| `convertToCSV` | Function | `src/enterprise/analytics-reports.ts` | 347 |
| `validateMetricName` | Function | `src/enterprise/analytics-reports.ts` | 83 |
| `validateGroupByField` | Function | `src/enterprise/analytics-reports.ts` | 91 |
| `buildGroupByExpressions` | Function | `src/enterprise/analytics-reports.ts` | 207 |
| `getRealTimeMetrics` | Function | `src/enterprise/analytics-dashboard.ts` | 8 |
| `checkAlerts` | Function | `src/enterprise/analytics-dashboard.ts` | 34 |
| `getTrendData` | Function | `src/enterprise/analytics-dashboard.ts` | 67 |
| `getApiMetrics` | Function | `src/enterprise/analytics-system.ts` | 6 |
| `getDatabaseMetrics` | Function | `src/enterprise/analytics-system.ts` | 57 |
| `getIntegrationMetrics` | Function | `src/enterprise/analytics-system.ts` | 83 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Services | 18 calls |

## How to Explore

1. `gitnexus_context({name: "getConversationMetrics"})` — see callers and callees
2. `gitnexus_query({query: "enterprise"})` — find related execution flows
3. Read key files listed above for implementation details
