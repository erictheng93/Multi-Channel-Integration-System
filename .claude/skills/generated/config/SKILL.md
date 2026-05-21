---
name: config
description: "Skill for the Config area of Multi-Channel-Integration-System. 43 symbols across 10 files."
---

# Config

43 symbols | 10 files | Cohesion: 88%

## When to Use

- Working with code in `src/`
- Understanding how convertToProxyUrl, downloadQRCodeCard, getCurrentEnvironment work
- Modifying config-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `frontend/src/config/runtime.ts` | getEnv, getBooleanEnv, getNumberEnv, getCurrentEnvironment, getBackendUrl (+6) |
| `src/config/runtime.ts` | getEnv, getCurrentEnvironment, getBackendUrl, getFrontendUrl, getWebSocketUrl (+4) |
| `src/config/cors.ts` | getAllowedOrigins, createCorsErrorDetails, createCorsBlockedResponse, isOriginAllowed, addCorsHeaders (+1) |
| `src/config/security.ts` | sanitizeLogData, isDevelopment, log, error, debug |
| `src/config/environment.ts` | getCurrentEnvironment, getEnvironmentConfig, getBackendUrl, getWebSocketUrl |
| `frontend/src/config/features.ts` | isFeatureEnabled, getFeatureConfig, checkNetworkConditions |
| `frontend/src/composables/team-management/useQRCodeDownloader.ts` | convertToProxyUrl, downloadQRCodeCard |
| `src/services/webhook-url-service.ts` | getWebhookUrl |
| `frontend/src/config/realtime.ts` | loadRealtimeConfig |
| `frontend/src/composables/team-management/useQRCodeOperations.ts` | startBackgroundPreload |

## Entry Points

Start here when exploring this area:

- **`convertToProxyUrl`** (Function) — `frontend/src/composables/team-management/useQRCodeDownloader.ts:67`
- **`downloadQRCodeCard`** (Function) — `frontend/src/composables/team-management/useQRCodeDownloader.ts:116`
- **`getCurrentEnvironment`** (Function) — `src/config/runtime.ts:140`
- **`getBackendUrl`** (Function) — `src/config/runtime.ts:162`
- **`getFrontendUrl`** (Function) — `src/config/runtime.ts:187`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `convertToProxyUrl` | Function | `frontend/src/composables/team-management/useQRCodeDownloader.ts` | 67 |
| `downloadQRCodeCard` | Function | `frontend/src/composables/team-management/useQRCodeDownloader.ts` | 116 |
| `getCurrentEnvironment` | Function | `src/config/runtime.ts` | 140 |
| `getBackendUrl` | Function | `src/config/runtime.ts` | 162 |
| `getFrontendUrl` | Function | `src/config/runtime.ts` | 187 |
| `getWebSocketUrl` | Function | `src/config/runtime.ts` | 211 |
| `getStoragePublicUrl` | Function | `src/config/runtime.ts` | 233 |
| `isDevelopment` | Function | `src/config/runtime.ts` | 258 |
| `getRuntimeConfig` | Function | `src/config/runtime.ts` | 336 |
| `logRuntimeConfig` | Function | `src/config/runtime.ts` | 437 |
| `getWebhookUrl` | Function | `src/services/webhook-url-service.ts` | 62 |
| `loadRealtimeConfig` | Function | `frontend/src/config/realtime.ts` | 27 |
| `getCurrentEnvironment` | Function | `frontend/src/config/runtime.ts` | 141 |
| `getBackendUrl` | Function | `frontend/src/config/runtime.ts` | 161 |
| `getFrontendUrl` | Function | `frontend/src/config/runtime.ts` | 183 |
| `getWebSocketUrl` | Function | `frontend/src/config/runtime.ts` | 205 |
| `getStoragePublicUrl` | Function | `frontend/src/config/runtime.ts` | 226 |
| `isDevelopment` | Function | `frontend/src/config/runtime.ts` | 247 |
| `isDebugEnabled` | Function | `frontend/src/config/runtime.ts` | 271 |
| `getRuntimeConfig` | Function | `frontend/src/config/runtime.ts` | 383 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Services | 2 calls |

## How to Explore

1. `gitnexus_context({name: "convertToProxyUrl"})` — see callers and callees
2. `gitnexus_query({query: "config"})` — find related execution flows
3. Read key files listed above for implementation details
