# R2 Direct Serving Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the Worker proxy hop for R2 file downloads by routing through the already-configured `s3.daiwandist.com` custom domain.

**Architecture:** Create a unified `getPublicFileUrl(env, r2Key)` utility that all 4 URL generation sites delegate to. Priority chain: `STORAGE_PUBLIC_URL` -> `R2_CUSTOM_DOMAIN` -> `R2_PUBLIC_DOMAIN` -> Worker proxy fallback. Add `cacheControl` metadata to all R2 uploads so CF edge respects cache headers.

**Tech Stack:** Cloudflare Workers, R2, Hono, TypeScript strict mode, Vitest

**Spec:** `docs/superpowers/specs/2026-03-19-r2-direct-serving-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/utils/file-url.ts` | Single source of truth for R2 public URL generation |
| Create | `tests/unit/utils/file-url.test.ts` | Unit tests for URL generation utility |
| Modify | `src/utils/file-storage.ts` | Delegate URL generation; add `r2Key` to `MediaFile`; add `cacheControl` to uploads |
| Modify | `src/modules/file-management/services/presigned-url-service.ts` | Replace `getPublicUrl()` with unified utility |
| Modify | `src/modules/file-management/services/storage-service.ts` | Replace `generateSignedUrl()` URL logic with unified utility |
| Modify | `src/modules/messaging/handlers/messaging/routes/attachments.ts` | Replace inline URL derivation; add `cacheControl` |
| Modify | `src/durable-objects/CustomerMessageDO.ts` | Replace `R2_PUBLIC_URL` usage; add `cacheControl` |
| Modify | `src/modules/file-management/handlers/file-proxy.ts` | Fix self-heal r2Key extraction |
| Modify | `src/types/bindings.ts` | Make `R2_PUBLIC_URL` optional |
| Modify | `config/r2-cors-config.json` | Add production frontend origin |

---

### Task 1: CORS Config Fix

**Files:**
- Modify: `config/r2-cors-config.json`

This must happen first -- without the production frontend origin in the CORS config, direct R2 access from the frontend will fail.

- [ ] **Step 1: Add production frontend origin to CORS config**

In `config/r2-cors-config.json`, add `https://mcis.daiwandist.com` to the `allowed.origins` array:

```json
{
  "rules": [
    {
      "allowed": {
        "origins": [
          "https://mcis.daiwandist.com",
          "https://mcis-ey7.pages.dev",
          "https://mcis-backend.daiwandist.com",
          "https://s3.daiwandist.com",
          "http://localhost:3000",
          "http://localhost:3001",
          "http://localhost:5173",
          "http://127.0.0.1:3000"
        ],
        "methods": ["GET", "PUT", "HEAD", "DELETE"],
        "headers": ["content-type", "content-length", "x-amz-content-sha256", "x-amz-date", "authorization", "cache-control", "x-requested-with"]
      },
      "exposeHeaders": ["ETag", "Content-Length", "Content-Type"],
      "maxAgeSeconds": 3600
    }
  ]
}
```

Note: Also added `http://localhost:5173` (Vite dev server port from `frontend/`).

- [ ] **Step 2: Apply CORS config to R2 bucket**

Run (requires wrangler auth):
```bash
npx wrangler r2 bucket cors put mcis-files --rules ./config/r2-cors-config.json
```

Expected: `Successfully applied CORS rules` or similar success message.

- [ ] **Step 3: Verify CORS with curl**

```bash
curl -I -H "Origin: https://mcis.daiwandist.com" https://s3.daiwandist.com/media/line/2026/3/some-existing-key.jpg
```

Expected: Response includes `Access-Control-Allow-Origin: https://mcis.daiwandist.com`.

If you don't know an existing key, list one:
```bash
npx wrangler r2 object list mcis-files --prefix media/ --max-keys 1
```

- [ ] **Step 4: Commit**

```bash
git add config/r2-cors-config.json
git commit -m "fix(cors): add production frontend origin to R2 CORS config

Without this, browser requests from mcis.daiwandist.com to
s3.daiwandist.com would be blocked by CORS policy."
```

---

### Task 2: Type Fix -- Make `R2_PUBLIC_URL` Optional in `bindings.ts`

**Files:**
- Modify: `src/types/bindings.ts:110`

Currently `R2_PUBLIC_URL: string` (required) in `bindings.ts` but `R2_PUBLIC_URL?: string` (optional) in `types/index.ts`. The canonical env var is `STORAGE_PUBLIC_URL`. Fix `bindings.ts` to make it optional (aligning with `index.ts` which is already correct).

> **Note:** The spec's table lists `src/types/index.ts` as the file to modify, but that file already has `R2_PUBLIC_URL?: string` (optional). The actual problem is in `src/types/bindings.ts` -- this task fixes the right file.

- [ ] **Step 1: Fix the type declaration**

In `src/types/bindings.ts`, change line 110 from:
```typescript
R2_PUBLIC_URL: string;
```
to:
```typescript
R2_PUBLIC_URL?: string;
```

- [ ] **Step 2: Run type check to verify no breakage**

```bash
bun run build
```

Expected: No new type errors. Existing code already handles `R2_PUBLIC_URL` being potentially undefined (e.g., `env.R2_PUBLIC_URL || ''` in `presigned-url-service.ts:80`).

- [ ] **Step 3: Commit**

```bash
git add src/types/bindings.ts
git commit -m "fix(types): make R2_PUBLIC_URL optional in Bindings

Aligns with types/index.ts where it's already optional. The canonical
env var for public R2 access is STORAGE_PUBLIC_URL."
```

---

### Task 3: Create Unified URL Generation Utility (TDD)

**Files:**
- Create: `src/utils/file-url.ts`
- Create: `tests/unit/utils/file-url.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/utils/file-url.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getPublicFileUrl, isPublicDomainConfigured } from '@/utils/file-url';
import type { Bindings } from '@/types';

// Minimal mock env factory
function mockEnv(overrides: Partial<Bindings> = {}): Bindings {
  return {
    STORAGE_PUBLIC_URL: undefined,
    R2_CUSTOM_DOMAIN: undefined,
    R2_PUBLIC_DOMAIN: undefined,
    BACKEND_URL: 'https://mcis-backend.daiwandist.com',
    ...overrides,
  } as unknown as Bindings;
}

describe('getPublicFileUrl', () => {
  const r2Key = 'media/line/2026/3/abc123.jpg';

  it('uses STORAGE_PUBLIC_URL when available (priority 1)', () => {
    const env = mockEnv({ STORAGE_PUBLIC_URL: 'https://s3.daiwandist.com' });
    expect(getPublicFileUrl(env, r2Key)).toBe(
      'https://s3.daiwandist.com/media/line/2026/3/abc123.jpg'
    );
  });

  it('strips trailing slash from STORAGE_PUBLIC_URL', () => {
    const env = mockEnv({ STORAGE_PUBLIC_URL: 'https://s3.daiwandist.com/' });
    expect(getPublicFileUrl(env, r2Key)).toBe(
      'https://s3.daiwandist.com/media/line/2026/3/abc123.jpg'
    );
  });

  it('uses R2_CUSTOM_DOMAIN when STORAGE_PUBLIC_URL is not set (priority 2)', () => {
    const env = mockEnv({ R2_CUSTOM_DOMAIN: 'cdn.example.com' });
    expect(getPublicFileUrl(env, r2Key)).toBe(
      'https://cdn.example.com/media/line/2026/3/abc123.jpg'
    );
  });

  it('uses R2_PUBLIC_DOMAIN when higher-priority vars are not set (priority 3)', () => {
    const env = mockEnv({ R2_PUBLIC_DOMAIN: 'r2pub.example.com' });
    expect(getPublicFileUrl(env, r2Key)).toBe(
      'https://r2pub.example.com/media/line/2026/3/abc123.jpg'
    );
  });

  it('falls back to Worker proxy when no public domain is configured (priority 4)', () => {
    const env = mockEnv({});
    expect(getPublicFileUrl(env, r2Key)).toBe(
      'https://mcis-backend.daiwandist.com/api/files/public/media/line/2026/3/abc123.jpg'
    );
  });

  it('falls back to Worker proxy using getBackendUrl when BACKEND_URL is also missing', () => {
    const env = mockEnv({ BACKEND_URL: undefined });
    const url = getPublicFileUrl(env, r2Key);
    // Should still produce a valid URL (getBackendUrl has its own fallback logic)
    expect(url).toContain('/api/files/public/');
    expect(url).toContain(r2Key);
  });

  it('handles r2Key with leading slash', () => {
    const env = mockEnv({ STORAGE_PUBLIC_URL: 'https://s3.daiwandist.com' });
    expect(getPublicFileUrl(env, '/media/line/2026/3/abc123.jpg')).toBe(
      'https://s3.daiwandist.com/media/line/2026/3/abc123.jpg'
    );
  });

  it('STORAGE_PUBLIC_URL takes priority over R2_CUSTOM_DOMAIN', () => {
    const env = mockEnv({
      STORAGE_PUBLIC_URL: 'https://s3.daiwandist.com',
      R2_CUSTOM_DOMAIN: 'cdn.example.com',
    });
    expect(getPublicFileUrl(env, r2Key)).toBe(
      'https://s3.daiwandist.com/media/line/2026/3/abc123.jpg'
    );
  });

  it('handles local dev STORAGE_PUBLIC_URL (localhost)', () => {
    const env = mockEnv({ STORAGE_PUBLIC_URL: 'http://localhost:8787/files' });
    expect(getPublicFileUrl(env, r2Key)).toBe(
      'http://localhost:8787/files/media/line/2026/3/abc123.jpg'
    );
  });
});

describe('isPublicDomainConfigured', () => {
  it('returns true when STORAGE_PUBLIC_URL is set', () => {
    const env = mockEnv({ STORAGE_PUBLIC_URL: 'https://s3.daiwandist.com' });
    expect(isPublicDomainConfigured(env)).toBe(true);
  });

  it('returns true when R2_CUSTOM_DOMAIN is set', () => {
    const env = mockEnv({ R2_CUSTOM_DOMAIN: 'cdn.example.com' });
    expect(isPublicDomainConfigured(env)).toBe(true);
  });

  it('returns false when no public domain vars are set', () => {
    const env = mockEnv({});
    expect(isPublicDomainConfigured(env)).toBe(false);
  });

  it('returns false for localhost URLs (dev environment)', () => {
    const env = mockEnv({ STORAGE_PUBLIC_URL: 'http://localhost:8787/files' });
    expect(isPublicDomainConfigured(env)).toBe(false);
  });

  it('returns false when R2_CUSTOM_DOMAIN is localhost', () => {
    const env = mockEnv({ R2_CUSTOM_DOMAIN: 'localhost:8787' });
    expect(isPublicDomainConfigured(env)).toBe(false);
  });

  it('returns true when R2_PUBLIC_DOMAIN is a real domain', () => {
    const env = mockEnv({ R2_PUBLIC_DOMAIN: 'r2pub.example.com' });
    expect(isPublicDomainConfigured(env)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/unit/utils/file-url.test.ts
```

Expected: FAIL -- module `@/utils/file-url` not found.

- [ ] **Step 3: Write the implementation**

Create `src/utils/file-url.ts`:

```typescript
/**
 * Unified R2 public file URL generation
 *
 * Single source of truth for generating public-facing URLs to R2 files.
 * Priority chain:
 *   1. STORAGE_PUBLIC_URL  (e.g., "https://s3.daiwandist.com")
 *   2. R2_CUSTOM_DOMAIN    (e.g., "cdn.example.com")
 *   3. R2_PUBLIC_DOMAIN    (e.g., "r2pub.example.com")
 *   4. Worker proxy fallback via BACKEND_URL
 *
 * Note on types: getBackendUrl() accepts WorkerEnv, Bindings is a superset
 * of WorkerEnv (structural subtyping), so passing Bindings compiles cleanly.
 * Priority 4 (Worker proxy) requires BACKEND_URL to be set. In production
 * this is always the case (wrangler.toml), and priority 1 (STORAGE_PUBLIC_URL)
 * is also always set, so priority 4 is only reached in misconfigured envs.
 */

import type { Bindings } from '@/types';
import { getBackendUrl } from '@/config/runtime';

function isLocalhost(value: string): boolean {
  return value.includes('localhost') || value.includes('127.0.0.1');
}

/**
 * Generate a public URL for an R2 file.
 *
 * @param env - Worker bindings (reads STORAGE_PUBLIC_URL, R2_CUSTOM_DOMAIN, etc.)
 * @param r2Key - The R2 object key (e.g., "media/line/2026/3/abc.jpg")
 * @returns Fully qualified public URL
 */
export function getPublicFileUrl(env: Bindings, r2Key: string): string {
  // Normalize: strip leading slash from r2Key
  const normalizedKey = r2Key.replace(/^\//, '');

  // Priority 1: STORAGE_PUBLIC_URL (canonical production var)
  if (env.STORAGE_PUBLIC_URL) {
    const base = env.STORAGE_PUBLIC_URL.replace(/\/$/, '');
    return `${base}/${normalizedKey}`;
  }

  // Priority 2: R2_CUSTOM_DOMAIN (bare domain, no protocol)
  if (env.R2_CUSTOM_DOMAIN) {
    return `https://${env.R2_CUSTOM_DOMAIN.replace(/\/$/, '')}/${normalizedKey}`;
  }

  // Priority 3: R2_PUBLIC_DOMAIN (bare domain, no protocol)
  if (env.R2_PUBLIC_DOMAIN) {
    return `https://${env.R2_PUBLIC_DOMAIN.replace(/\/$/, '')}/${normalizedKey}`;
  }

  // Priority 4: Worker proxy fallback (requires BACKEND_URL in production)
  const backendUrl = getBackendUrl(env);
  return `${backendUrl}/api/files/public/${normalizedKey}`;
}

/**
 * Check whether a real public R2 domain is configured (non-localhost).
 * Useful for deciding whether to set R2-level cacheControl headers.
 */
export function isPublicDomainConfigured(env: Bindings): boolean {
  const url = env.STORAGE_PUBLIC_URL || '';
  if (url && !isLocalhost(url)) {
    return true;
  }
  // Also check bare domain vars, filtering out localhost values
  const customDomain = env.R2_CUSTOM_DOMAIN || '';
  if (customDomain && !isLocalhost(customDomain)) {
    return true;
  }
  const publicDomain = env.R2_PUBLIC_DOMAIN || '';
  if (publicDomain && !isLocalhost(publicDomain)) {
    return true;
  }
  return false;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/unit/utils/file-url.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Run full backend type check**

```bash
bun run build
```

Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add src/utils/file-url.ts tests/unit/utils/file-url.test.ts
git commit -m "feat(storage): add unified getPublicFileUrl() utility

Single source of truth for R2 public URL generation with priority chain:
STORAGE_PUBLIC_URL > R2_CUSTOM_DOMAIN > R2_PUBLIC_DOMAIN > Worker proxy.
Includes isPublicDomainConfigured() helper for cache decisions."
```

---

### Task 4: Update `FileStorageService` -- URL Generation + `r2Key` on MediaFile + cacheControl

**Files:**
- Modify: `src/utils/file-storage.ts:12-21` (MediaFile interface)
- Modify: `src/utils/file-storage.ts:105-116` (R2 upload -- add cacheControl)
- Modify: `src/utils/file-storage.ts:121-133` (add r2Key to return)
- Modify: `src/utils/file-storage.ts:240-247` (generatePublicUrl -- delegate to utility)

- [ ] **Step 1: Add `r2Key` to the `MediaFile` interface**

In `src/utils/file-storage.ts`, change the `MediaFile` interface (lines 12-21):

```typescript
// Legacy interface for backward compatibility
export interface MediaFile {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  r2Key: string;
  originalUrl?: string;
  platform: string;
  messageId?: string;
}
```

- [ ] **Step 2: Update `generatePublicUrl()` to delegate to unified utility**

Add the import at the top of `src/utils/file-storage.ts` (after existing imports, around line 9):

```typescript
import { getPublicFileUrl } from '@/utils/file-url';
```

Then replace the `generatePublicUrl` method (lines 240-247):

```typescript
  generatePublicUrl(storageKey: string, _apiHost?: string): string {
    return getPublicFileUrl(this.env, storageKey);
  }
```

Also remove the now-unused import of `getBackendUrl` from line 8 (if no other code in the file uses it -- check first with grep).

- [ ] **Step 3: Add `cacheControl` to the R2 upload call**

In `src/utils/file-storage.ts`, update the `R2_BUCKET.put()` call (lines 105-116):

```typescript
      await this.env.R2_BUCKET.put(storageKey, fileBuffer, {
        httpMetadata: {
          contentType: mimeType,
          contentDisposition: `inline; filename="${filename}"`,
          cacheControl: 'public, max-age=604800'
        },
        customMetadata: {
          originalUrl,
          platform,
          messageId: messageId || '',
          uploadedAt: nowISO()
        }
      });
```

- [ ] **Step 4: Add `r2Key` to the returned MediaFile object**

In `src/utils/file-storage.ts`, update the `mediaFile` construction (around lines 124-133):

```typescript
      const mediaFile: MediaFile = {
        id: fileId,
        filename: filename || `file_${fileId}${extension}`,
        mimeType,
        size: contentLength,
        url: publicUrl,
        r2Key: storageKey,
        originalUrl,
        platform,
        messageId: messageId || ''
      };
```

- [ ] **Step 5: Run type check**

```bash
bun run build
```

Expected: PASS. Adding `r2Key` to `MediaFile` is additive (no existing code is broken by adding a new required field to the interface -- only places that construct a `MediaFile` need updating, and that's done in Step 4 above). The `file-proxy.ts` self-heal code accesses `mediaFile.url` and `mediaFile.id` (not `r2Key` yet), so it continues to compile. Task 7 will update it to use the new `r2Key` field.

> **Note:** The spec's table lists `src/types/file-storage.ts` as needing a `r2Key` addition. However, that file defines `MediaFileInfo` (a different interface), not `MediaFile`. The actual `MediaFile` interface lives in `src/utils/file-storage.ts` (lines 12-21), which is what this task modifies. The spec's table entry is an error; no changes needed in `src/types/file-storage.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/utils/file-storage.ts
git commit -m "refactor(storage): delegate URL generation to unified utility

- generatePublicUrl() now calls getPublicFileUrl() instead of hardcoding
  Worker proxy URL
- Added r2Key field to MediaFile interface for downstream consumers
- Added cacheControl header to R2 uploads for CF edge caching"
```

---

### Task 5: Update `PresignedUrlService` -- Use Unified Utility

**Files:**
- Modify: `src/modules/file-management/services/presigned-url-service.ts:74,80,335-350`

- [ ] **Step 1: Add import for unified utility**

At the top of `presigned-url-service.ts`, add:

```typescript
import { getPublicFileUrl } from '@/utils/file-url';
```

- [ ] **Step 2: Replace `getPublicUrl()` method**

Replace the private method at lines 335-350:

```typescript
  private getPublicUrl(r2Key: string): string {
    return getPublicFileUrl(this.env, r2Key);
  }
```

- [ ] **Step 3: Remove the `publicUrl` instance variable**

Remove line 74 (`private publicUrl: string;`) and line 80 (`this.publicUrl = env.R2_PUBLIC_URL || '';`). The `publicUrl` field is only used by `getPublicUrl()`, which now delegates to the unified utility.

If `publicUrl` is used elsewhere in the class, grep first:
```bash
# Check usage within the file
grep -n "this.publicUrl" src/modules/file-management/services/presigned-url-service.ts
```

If only used in `getPublicUrl`, remove it. If used elsewhere, keep the field but update `getPublicUrl` only.

- [ ] **Step 4: Run type check**

```bash
bun run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/file-management/services/presigned-url-service.ts
git commit -m "refactor(presigned): use unified getPublicFileUrl() utility

Fixes pre-existing bug where service read R2_PUBLIC_URL (not set in
wrangler.toml) instead of STORAGE_PUBLIC_URL. Presigned upload URLs
now correctly point to s3.daiwandist.com.

Note: The old fallback path was /api/files/download/ (not /public/).
The unified utility uses /api/files/public/ as its Worker fallback.
Both routes exist and work. In production, STORAGE_PUBLIC_URL is set
so the Worker fallback is never reached."
```

---

### Task 6: Update `StorageService` and `attachments.ts` -- Use Unified Utility

**Files:**
- Modify: `src/modules/file-management/services/storage-service.ts:197-212,321-342`
- Modify: `src/modules/messaging/handlers/messaging/routes/attachments.ts:149-165`

- [ ] **Step 1: Update `storage-service.ts` upload URL generation**

Add import at top of `storage-service.ts`:

```typescript
import { getPublicFileUrl } from '@/utils/file-url';
```

Replace lines 202-205 (the upload success URL generation):

```typescript
            const publicUrl = getPublicFileUrl(env, key);
```

Replace lines 327-333 (the `generateSignedUrl` function body):

```typescript
    generateSignedUrl: async (key: string, _operation: string, _expiresIn?: number) => {
      try {
        logger.info('Generating signed URL', { key });
        return getPublicFileUrl(env, key);
      } catch (error) {
        logger.error('Signed URL generation failed', error as Error, { key });
        throw new FileManagementError(
          ERROR_CODES.STORAGE_ERROR,
          { operation: 'generateSignedUrl', metadata: { key } },
          { originalError: error as Error }
        );
      }
    },
```

- [ ] **Step 2: Update `attachments.ts` URL generation and add cacheControl**

Add import at top of `attachments.ts`:

```typescript
import { getPublicFileUrl } from '@/utils/file-url';
```

Replace the R2 upload block (lines 152-156) to add `cacheControl`:

```typescript
      await c.env.R2_BUCKET.put(r2Key, arrayBuffer, {
        httpMetadata: {
          contentType: file.type,
          cacheControl: 'public, max-age=604800'
        }
      });
```

Replace the URL generation (lines 162-165):

```typescript
    // Generate public URL via unified utility
    const fileUrl = getPublicFileUrl(c.env, r2Key);
```

Remove the now-unused `requestUrl` / `baseUrl` variables (lines 163-164).

- [ ] **Step 3: Run type check**

```bash
bun run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/modules/file-management/services/storage-service.ts src/modules/messaging/handlers/messaging/routes/attachments.ts
git commit -m "refactor(storage): unify URL generation in StorageService and attachments

- StorageService: replaced broken WORKER_DOMAIN fallback with unified utility
- attachments.ts: replaced request-host URL derivation with getPublicFileUrl()
- Added cacheControl to attachment R2 uploads"
```

---

### Task 7: Update `CustomerMessageDO` and Fix Self-Heal Logic

**Files:**
- Modify: `src/durable-objects/CustomerMessageDO.ts:611-618`
- Modify: `src/modules/file-management/handlers/file-proxy.ts:215-220`

**Verified:** `CustomerMessageDO` extends `DurableObject<Bindings>` and its constructor takes `env: Bindings` (line 50, 53), so `getPublicFileUrl(this.env, ...)` is type-safe.

- [ ] **Step 1: Update CustomerMessageDO upload**

Add import at top of `CustomerMessageDO.ts`:

```typescript
import { getPublicFileUrl } from '@/utils/file-url';
```

Replace lines 611-618:

```typescript
        // Upload to R2
        await this.env.R2_BUCKET.put(uniqueFilename, file, {
          httpMetadata: {
            contentType: file.type,
            cacheControl: 'public, max-age=604800'
          }
        });

        // Generate the public URL
        const assetUrl = getPublicFileUrl(this.env, uniqueFilename);
```

- [ ] **Step 2: Fix self-heal r2Key extraction in file-proxy.ts**

In `src/modules/file-management/handlers/file-proxy.ts`, find the self-heal block (around lines 215-220). The current code:

```typescript
const mediaFile = await processLineMediaMessage(c.env, lineMessageId, 'image');
if (mediaFile) {
  const r2Key = mediaFile.url.includes('/api/files/public/')
    ? mediaFile.url.split('/api/files/public/')[1]
    : `media/line/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${mediaFile.id}`;
```

Replace the `r2Key` extraction with:

```typescript
              const mediaFile = await processLineMediaMessage(c.env, lineMessageId, 'image');
              if (mediaFile) {
                // Use the r2Key field directly (added in this optimization)
                const r2Key = mediaFile.r2Key;
```

- [ ] **Step 3: Run type check**

```bash
bun run build
```

Expected: PASS. The `mediaFile.r2Key` is now part of the `MediaFile` interface (from Task 4).

- [ ] **Step 4: Run full test suite to check for regressions**

```bash
npx vitest run
```

Expected: All existing tests pass. No tests currently cover these specific code paths (verified: no file-storage/file-proxy tests exist).

- [ ] **Step 5: Commit**

```bash
git add src/durable-objects/CustomerMessageDO.ts src/modules/file-management/handlers/file-proxy.ts
git commit -m "fix(storage): update CustomerMessageDO and self-heal to use unified URLs

- CustomerMessageDO: replaced env.R2_PUBLIC_URL with getPublicFileUrl()
- file-proxy.ts: self-heal now uses mediaFile.r2Key instead of parsing URL
- Added cacheControl to customer file uploads"
```

---

### Task 8: Manual Verification

No code changes. Verify the optimization works end-to-end.

- [ ] **Step 1: Verify direct R2 access via custom domain**

```bash
# List an existing file in the bucket
npx wrangler r2 object list mcis-files --prefix media/ --max-keys 1
```

Take the key from the output and verify direct access:

```bash
curl -I https://s3.daiwandist.com/<key-from-above>
```

Expected: HTTP 200, `Content-Type` matches file type, CORS headers present for requests with Origin header.

- [ ] **Step 2: Verify CORS from production frontend**

```bash
curl -I -H "Origin: https://mcis.daiwandist.com" -H "Access-Control-Request-Method: GET" -X OPTIONS https://s3.daiwandist.com/<key-from-above>
```

Expected: `Access-Control-Allow-Origin: https://mcis.daiwandist.com`.

- [ ] **Step 3: Verify Worker proxy still works (backward compatibility)**

```bash
curl -I https://mcis-backend.daiwandist.com/api/files/public/<key-from-above>
```

Expected: HTTP 200 -- existing proxy route still serves files.

- [ ] **Step 4: Deploy and verify in production**

```bash
bun run deploy
```

After deploy, test by sending a LINE message with an image. Verify in browser DevTools that the image `src` attribute points to `https://s3.daiwandist.com/...` instead of `https://mcis-backend.daiwandist.com/api/files/public/...`.

---

### Task 9: Final Commit and Cleanup

- [ ] **Step 1: Run full test suite one more time**

```bash
npx vitest run
cd frontend && bun run test
```

Expected: All tests pass.

- [ ] **Step 2: Run health checks**

```bash
bash scripts/check.sh
```

Expected: All checks pass.

- [ ] **Step 3: Verify no unused imports remain**

Check that removed imports (like `getBackendUrl` from `file-storage.ts` if it was the only usage) don't leave dead code.

```bash
bun run build
cd frontend && bun run type-check
```

Expected: Clean builds.
