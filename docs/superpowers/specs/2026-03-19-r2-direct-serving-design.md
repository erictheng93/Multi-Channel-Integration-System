# R2 Direct Serving Optimization

**Date:** 2026-03-19
**Status:** Reviewed
**Priority:** P1 — Performance

## Problem Statement

All R2 file downloads are proxied through the Cloudflare Worker (`file-proxy.ts`), causing:

1. **Extra network hop**: Client -> Worker -> R2 -> Worker -> Client
2. **Bandwidth amplification**: File bytes transferred twice (R2->Worker, Worker->Client)
3. **Worker CPU/memory consumed** for static file serving
4. **Worker request quota consumed** by file downloads
5. **No CDN edge caching benefit** — Worker-level `Cache-Control` headers don't trigger CF edge caching

The R2 custom domain `s3.daiwandist.com` is already configured and active, but the primary `FileStorageService.generatePublicUrl()` ignores it entirely.

## Root Cause

**Four** separate code paths generate file URLs with inconsistent strategies:

| Service | File | Uses Public Domain? | Pre-existing Bug? |
|---------|------|-------------------|--------------------|
| `FileStorageService.generatePublicUrl()` | `src/utils/file-storage.ts:240-246` | **No** -- always returns Worker proxy URL | Yes -- ignores `STORAGE_PUBLIC_URL` |
| `PresignedUrlService.getPublicUrl()` | `src/modules/file-management/services/presigned-url-service.ts:335-350` | Intended but broken -- reads `R2_PUBLIC_URL` which is not set in `wrangler.toml` | Yes -- reads wrong env var |
| `StorageService.generateSignedUrl()` | `src/modules/file-management/services/storage-service.ts:321-342` | Intended but broken -- falls back to `WORKER_DOMAIN` which is a placeholder | Yes -- `your-worker.workers.dev` literal |
| `attachments.ts` POST route | `src/modules/messaging/handlers/messaging/routes/attachments.ts:163-165` | **No** -- derives URL from incoming request host | Not a bug per se, but bypasses any config |

Additionally, `CustomerMessageDO.ts:618` uses `env.R2_PUBLIC_URL` directly (type inconsistency: required in `bindings.ts`, optional in `index.ts`).

The `FileStorageService` is the primary URL generator (used by LINE/FB media processing), so the majority of file URLs point to the Worker proxy.

### Environment Configuration (already in place)

- `wrangler.toml:25`: `STORAGE_PUBLIC_URL = "https://s3.daiwandist.com"` -- **already configured, ignored by code**
- `frontend/.env.production:23`: `VITE_STORAGE_PUBLIC_URL=https://s3.daiwandist.com` -- used only by QR code downloader
- `.dev.vars`: `STORAGE_PUBLIC_URL=http://localhost:8787/files` -- local dev correctly routes through Worker
- **No new env vars needed.** This optimization is a pure code change.

## Design

### Approach: Hybrid (Public Domain + Worker Fallback)

- **Public media files** (images, video, audio from LINE/FB, agent attachments): Serve directly via `https://s3.daiwandist.com/{r2Key}`
- **LINE proxy fallback**: Keep `/api/files/line-proxy/:lineMessageId` for LINE API auth pass-through and self-healing
- **Worker proxy**: Retain `/api/files/public/*` and `/api/files/download/*` as backward-compatible fallback for any existing stored URLs

### Component 1: Unified URL Generation Utility

Create a single `getPublicFileUrl(env, r2Key)` function used by **all** URL generation sites:

```
Priority chain:
1. env.STORAGE_PUBLIC_URL  -> "https://s3.daiwandist.com/{r2Key}"   (production)
2. env.R2_CUSTOM_DOMAIN    -> "https://{domain}/{r2Key}"
3. env.R2_PUBLIC_DOMAIN    -> "https://{domain}/{r2Key}"
4. Worker proxy fallback   -> "{BACKEND_URL}/api/files/public/{r2Key}"
```

**Location:** `src/utils/file-url.ts` (new file, single responsibility)

**Interface:**
```typescript
export function getPublicFileUrl(env: Bindings, r2Key: string): string;
export function isPublicDomainConfigured(env: Bindings): boolean;
```

### Component 2: FileStorageService Update

Update `generatePublicUrl()` in `src/utils/file-storage.ts` to delegate to the unified utility instead of hardcoding the Worker proxy URL.

Also add `r2Key` to the `MediaFile` return interface so that callers (especially the self-heal logic) can access the storage key without parsing the URL.

### Component 3: All URL Generation Sites Alignment

Replace inline URL generation logic in all services with calls to `getPublicFileUrl()`:

- `PresignedUrlService.getPublicUrl()` -- currently reads wrong var (`R2_PUBLIC_URL` instead of `STORAGE_PUBLIC_URL`)
- `StorageService.generateSignedUrl()` -- currently has broken `your-worker.workers.dev` fallback
- `attachments.ts:163-165` -- currently derives URL from request host
- `CustomerMessageDO.ts:618` -- currently uses `env.R2_PUBLIC_URL` directly

### Component 4: R2 Upload Metadata Enhancement

When uploading files to R2, set `cacheControl` in `httpMetadata` so that files served via the custom domain carry proper cache headers:

```typescript
httpMetadata: {
  contentType: mimeType,
  contentDisposition: `inline; filename="${filename}"`,
  cacheControl: 'public, max-age=604800' // 7 days at R2 level
}
```

This ensures the CF edge cache respects caching when serving from `s3.daiwandist.com`.

**Upload sites to update:**
- `src/utils/file-storage.ts:99-116` (LINE/FB media)
- `src/modules/messaging/handlers/messaging/routes/attachments.ts:149-156` (agent attachments)
- `src/durable-objects/CustomerMessageDO.ts:611-615` (customer uploads)

### Component 5: Self-Heal Logic Fix

The LINE proxy self-heal in `file-proxy.ts:218-220` extracts the r2Key by parsing the URL:

```typescript
// CURRENT (will break after URL format change):
const r2Key = mediaFile.url.includes('/api/files/public/')
  ? mediaFile.url.split('/api/files/public/')[1]
  : `media/line/.../${mediaFile.id}`;
```

After this optimization, `mediaFile.url` will be `https://s3.daiwandist.com/media/line/...` and the parse will fail silently.

**Fix:** Use the new `r2Key` field on `MediaFile` (added in Component 2) instead of parsing the URL.

### Component 6: Backward Compatibility

- `/api/files/public/*` proxy routes remain operational (no deletion)
- Existing URLs stored in DB (`fileUrl` column) with `/api/files/public/` paths continue to work
- Frontend components that reference file URLs work regardless of format
- No DB migration to rewrite existing URLs (optional Phase 2 backfill)

### Component 7: CORS Config Fix

The R2 bucket CORS config (`config/r2-cors-config.json`) is **missing** the production frontend origin `https://mcis.daiwandist.com`. Without this, browsers loading files from `s3.daiwandist.com` on the production frontend will get CORS errors.

**Required change:** Add `https://mcis.daiwandist.com` to the allowed origins in `config/r2-cors-config.json`, then apply the config to the R2 bucket.

### Component 8: Type Consistency Fix

`R2_PUBLIC_URL` is declared as required in `src/types/bindings.ts:110` but optional in `src/types/index.ts:48`. Unify to optional (since `STORAGE_PUBLIC_URL` is the canonical var).

## Data Flow

### After optimization (new files):
```
1. LINE webhook receives image
2. Worker downloads from LINE API, uploads to R2 with cacheControl headers
3. Worker calls getPublicFileUrl(env, r2Key)
   -> returns "https://s3.daiwandist.com/media/line/2026/3/abc.jpg"
4. URL stored in DB (fileAttachments.fileUrl)
5. Frontend renders <img src="https://s3.daiwandist.com/media/line/2026/3/abc.jpg">
6. Browser fetches directly from CF edge -> R2 (no Worker involved)
```

### After optimization (existing files with old URLs):
```
1. Frontend renders <img src="https://mcis-backend.daiwandist.com/api/files/public/media/...">
2. Worker proxy still works (backward compat)
3. Optional: Phase 2 backfill migration rewrites old URLs
```

### Local development:
```
1. STORAGE_PUBLIC_URL = "http://localhost:8787/files" (from .dev.vars)
2. getPublicFileUrl() returns Worker proxy URL (expected for local dev)
3. No behavior change for development
```

## Files to Create/Modify

| Action | File | Description |
|--------|------|-------------|
| **Create** | `src/utils/file-url.ts` | Unified `getPublicFileUrl()` + `isPublicDomainConfigured()` |
| **Modify** | `src/utils/file-storage.ts` | Delegate `generatePublicUrl()` to unified utility; add `r2Key` to MediaFile return; add `cacheControl` to uploads |
| **Modify** | `src/modules/file-management/services/presigned-url-service.ts` | Replace `getPublicUrl()` with `getPublicFileUrl()` call |
| **Modify** | `src/modules/file-management/services/storage-service.ts` | Replace `generateSignedUrl()` with `getPublicFileUrl()` call |
| **Modify** | `src/modules/messaging/handlers/messaging/routes/attachments.ts` | Replace URL derivation (line 163-165) with `getPublicFileUrl()`; add `cacheControl` to upload |
| **Modify** | `src/durable-objects/CustomerMessageDO.ts` | Replace `env.R2_PUBLIC_URL` usage (line 618) with `getPublicFileUrl()`; add `cacheControl` to upload |
| **Modify** | `src/modules/file-management/handlers/file-proxy.ts` | Fix self-heal r2Key extraction to use `MediaFile.r2Key` instead of URL parsing |
| **Modify** | `src/types/file-storage.ts` | Add `r2Key` field to `MediaFile` interface |
| **Modify** | `src/types/index.ts` | Make `R2_PUBLIC_URL` optional (align with `bindings.ts`) |
| **Modify** | `config/r2-cors-config.json` | Add `https://mcis.daiwandist.com` to allowed origins |
| **Create** | `tests/unit/utils/file-url.test.ts` | Unit tests for URL generation (all 4 priority chain scenarios) |
| **Modify** | Existing file-storage tests | Update expectations for new URL format |

## Testing Strategy

1. **Unit tests** for `getPublicFileUrl()` -- all 4 priority chain scenarios + local dev
2. **Unit tests** for updated `generatePublicUrl()` -- verify delegation
3. **Manual verification** -- `curl https://s3.daiwandist.com/{existing-r2-key}` to confirm direct access works
4. **Integration test** -- upload a file, verify the returned URL points to public domain
5. **Backward compat test** -- verify old `/api/files/public/*` URLs still resolve
6. **CORS test** -- verify browser can fetch from `s3.daiwandist.com` on `https://mcis.daiwandist.com` without CORS errors
7. **Self-heal test** -- LINE proxy self-heal correctly writes r2Key when URL is in custom-domain format
8. **Presigned confirm test** -- confirm-upload response returns public domain URL when `STORAGE_PUBLIC_URL` is configured

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| CORS errors from new domain | Add `https://mcis.daiwandist.com` to R2 CORS config before rollout |
| Existing DB URLs break | Worker proxy retained as fallback; no URL rewriting in Phase 1 |
| Hotlinking / abuse | Monitor R2 egress; add CF WAF rules if needed (Phase 3) |
| Cache invalidation | R2 objects are immutable (unique keys per upload); no invalidation needed |
| Public domain downtime | `isPublicDomainConfigured()` check falls back to Worker proxy |
| Self-heal silent failure | Fixed by using `MediaFile.r2Key` instead of URL parsing |
| Local dev breakage | `.dev.vars` sets `STORAGE_PUBLIC_URL` to localhost; no change to dev flow |

## Success Metrics

- Worker request count for `/api/files/*` decreases by >80%
- Worker CPU time decreases measurably
- File download latency (P50) drops from ~200ms to <50ms (edge cache hit)
- Zero CORS errors in production logs
- All existing file URLs continue to resolve
