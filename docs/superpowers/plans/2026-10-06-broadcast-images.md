# 群發圖文（Broadcast Images）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 群發可發送「文字（選填）+ 最多 4 張圖片」，一次 LINE multicast 送達，並回寫到每位收件人的對話紀錄。

**Architecture:** 新增 `broadcast_attachments` 子表（原圖 + 預覽圖 + 位置）。前端以 canvas 產生 ≤1MB 預覽圖，原圖與預覽圖經既有 `POST /api/files/upload` 上傳。後端建立群發時驗證附件歸屬與規格；送出時由 `r2Key` 重新簽 10 年 URL、組 `[文字?, 圖...]` 訊息陣列；回寫時每位收件人一則訊息 + 每張圖一列 `file_attachments`（共用 r2Key），並修正 `FileService.deleteFile` 避免刪到共用的 R2 物件。

**Tech Stack:** Cloudflare Workers + Hono + Drizzle (D1) / Vue 3 + Pinia / Vitest (+ better-sqlite3 for migration tests) / Bun

**Spec:** `docs/superpowers/specs/2026-10-06-broadcast-images-design.md`

## Global Constraints

- 訊息組成：`[文字?] + [圖1..圖4]`，總數 ≤ 5（LINE multicast 上限）。
- 圖片：`image/jpeg`、`image/png`；原圖 ≤ 10MB（10 * 1024 * 1024）；預覽圖 ≤ 1MB（1024 * 1024）。
- 文字 trim 後 0–2000 字；文字為空時至少 1 張圖。
- 僅 LINE；Facebook 收件人沿用 `platform_not_supported_phase1` 略過。
- 圖片 URL 一律用 `getSignedFileUrl(env, r2Key, PERSISTENT_ATTACHMENT_URL_TTL_SECONDS)`。
- `hasQuota()` 不改（LINE 以收件人數計費）。
- 唯一約束必須同時寫在 migration SQL 與 `src/db/schema.ts`。
- 套用 migration 後跑 `bun run db:doc:schema`，SCHEMA.md 與 migration 同一個 commit；不得手改 SCHEMA.md。
- 不得在 component `<style>` 重定義 `.btn*`；UI 遵循 `docs/UIUX-Design-System.md`（Apple-Native Soft Minimalism）。
- 原始碼不得使用 emoji。
- 每個邏輯變更一個 commit（atomic commits）。
- 套用 remote migration、部署前必須先取得使用者明確同意。

## Review Focus

1. **他人的上傳**：A 上傳的圖片 id 被 B 拿去建群發 → 必須 422（Task 3 測試）。
2. **重複使用的附件**：同一個 attachmentId 在同一群發出現兩次，或已綁到某則對話訊息 → 必須 422（Task 2 測試）。
3. **純圖片群發**：content 為空字串 → LINE 訊息陣列不得含空 text（LINE 會拒絕空字串）（Task 2 測試）。
4. **刪除共用圖片**：在任一收件人對話中刪除群發圖片 → 其他收件人的圖仍可顯示（R2 不被刪）（Task 5 測試）。
5. **大圖預覽**：使用者選 5MB PNG → 產生的預覽圖 ≤ 1MB，且 jsdom 沒有 canvas 時邏輯仍可測（Task 6 用注入的 encoder 測試）。

---

## File Structure

| 檔案 | 責任 |
|---|---|
| `migrations/0063_add_broadcast_attachments.sql` | 建表 |
| `src/db/schema.ts` | `broadcastAttachments` Drizzle 定義 |
| `src/modules/broadcast/types/index.ts` | 新型別 |
| `src/modules/broadcast/services/broadcast-content.ts`（新） | 純函式：附件驗證、LINE 訊息組裝、回寫附件列組裝 |
| `src/modules/broadcast/services/broadcast-service.ts` | create 寫入附件、getById 回傳附件 |
| `src/modules/broadcast/handlers/broadcast-main.ts` | 解析 `attachments`、content 選填 |
| `src/modules/broadcast/services/broadcast-sender-service.ts` | 組訊息、回寫圖片 |
| `src/modules/broadcast/services/d1-chunks.ts` | 新 chunk size |
| `src/modules/file-management/services/file-service.ts` | deleteFile 共用 r2Key 保護 |
| `frontend/src/utils/broadcast-image-preview.ts`（新） | canvas 預覽圖產生 |
| `frontend/src/api/broadcasts.ts` | 型別 + 上傳函式 |
| `frontend/src/components/broadcast/BroadcastComposeCard.vue` | 圖片選取 UI |
| `frontend/src/components/broadcast/BroadcastDetailModal.vue` | 縮圖顯示 |
| `frontend/src/components/broadcast/BroadcastHistoryList.vue` | 「圖文」標記 |

---

### Task 1: broadcast_attachments 資料表

**Files:**
- Create: `migrations/0063_add_broadcast_attachments.sql`
- Modify: `src/db/schema.ts`（在 `broadcastRecipients` 定義之後，約 line 356）
- Test: `tests/database/broadcast-migration.test.ts`
- Regenerate: `docs/architecture/SCHEMA.md`

**Interfaces:**
- Produces: Drizzle table `broadcastAttachments`，欄位 `id, broadcastId, attachmentId, previewAttachmentId, position, createdAt`。

- [ ] **Step 1: 寫失敗測試**

在 `tests/database/broadcast-migration.test.ts` 的 `beforeEach` 的 `db.exec` 內加入 stub 表：

```sql
      CREATE TABLE file_attachments (
        id TEXT PRIMARY KEY NOT NULL
      );
```

並在 describe 內新增：

```ts
  it('enforces broadcast attachment position uniqueness, cascade and restrict', () => {
    applyMigration('0051_add_broadcast_tables.sql');
    applyMigration('0052_add_broadcast_identity_indexes.sql');
    applyMigration('0063_add_broadcast_attachments.sql');

    db.prepare('INSERT INTO agents (id) VALUES (?)').run('agent-1');
    db.prepare(`
      INSERT INTO broadcasts (id, title, content, tag_ids, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run('broadcast-1', 'Launch', '', '[1]', 'agent-1');
    for (const id of ['img-1', 'prev-1', 'img-2', 'prev-2']) {
      db.prepare('INSERT INTO file_attachments (id) VALUES (?)').run(id);
    }

    const insert = db.prepare(`
      INSERT INTO broadcast_attachments (broadcast_id, attachment_id, preview_attachment_id, position)
      VALUES (?, ?, ?, ?)
    `);
    insert.run('broadcast-1', 'img-1', 'prev-1', 0);

    expect(() => insert.run('broadcast-1', 'img-2', 'prev-2', 0)).toThrow(/UNIQUE constraint failed/);
    expect(() => insert.run('broadcast-1', 'img-1', 'prev-2', 1)).toThrow(/UNIQUE constraint failed/);
    expect(() => db.prepare('DELETE FROM file_attachments WHERE id = ?').run('img-1'))
      .toThrow(/FOREIGN KEY constraint failed/);

    db.prepare('DELETE FROM broadcasts WHERE id = ?').run('broadcast-1');
    const remaining = db.prepare('SELECT COUNT(*) AS n FROM broadcast_attachments').get() as { n: number };
    expect(remaining.n).toBe(0);
  });
```

- [ ] **Step 2: 執行確認失敗**

Run: `bunx vitest run tests/database/broadcast-migration.test.ts`
Expected: FAIL，`ENOENT ... 0063_add_broadcast_attachments.sql`

- [ ] **Step 3: 建立 migration**

`migrations/0063_add_broadcast_attachments.sql`：

```sql
-- ===============================================
-- Migration 0063: broadcast image attachments
-- ===============================================
-- Date: 2026-10-06
--
-- A broadcast carries optional text plus up to 4 images (LINE multicast
-- allows 5 message objects). Each image has an original (<=10MB) and a
-- client-generated preview (<=1MB, LINE previewImageUrl limit).
-- UNIQUE constraints are inline so a schema.ts-driven rebuild keeps them
-- (see the 2026-06-17 drift incident).
CREATE TABLE IF NOT EXISTS broadcast_attachments (
  id INTEGER PRIMARY KEY,
  broadcast_id TEXT NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  attachment_id TEXT NOT NULL REFERENCES file_attachments(id) ON DELETE RESTRICT,
  preview_attachment_id TEXT NOT NULL REFERENCES file_attachments(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (broadcast_id, position),
  UNIQUE (broadcast_id, attachment_id)
);
```

- [ ] **Step 4: 加入 Drizzle 定義**

`src/db/schema.ts`，緊接在 `broadcastRecipients` 之後：

```ts
// Broadcast attachments - 群發圖片（原圖 + LINE 預覽圖，position 0..3）
export const broadcastAttachments = sqliteTable('broadcast_attachments', {
  id: integer('id').primaryKey(),
  broadcastId: text('broadcast_id').notNull().references(() => broadcasts.id, { onDelete: 'cascade' }),
  attachmentId: text('attachment_id').notNull().references(() => fileAttachments.id, { onDelete: 'restrict' }),
  previewAttachmentId: text('preview_attachment_id').notNull().references(() => fileAttachments.id, { onDelete: 'restrict' }),
  position: integer('position').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  broadcastPositionUnique: unique().on(table.broadcastId, table.position),
  broadcastAttachmentUnique: unique().on(table.broadcastId, table.attachmentId),
}));
```

- [ ] **Step 5: 執行測試確認通過**

Run: `bunx vitest run tests/database/broadcast-migration.test.ts`
Expected: PASS（3 tests）

- [ ] **Step 6: 型別檢查與 migration 一致性檢查**

Run: `bunx tsc --noEmit` → 無錯誤
Run: `bun run check:migrations` → 0063 列為「本地有、遠端未套用」，其餘無新漂移

- [ ] **Step 7: 【需使用者同意】套用到 production D1 並重生 SCHEMA.md**

先詢問使用者：「即將對 production D1 執行 migration 0063（純新增表，不動既有資料），可以嗎？」取得同意後：

Run: `bun run db:migrate`
Run: `bun run db:doc:schema`
Run: `bun run db:doc:schema:check` → exit 0

- [ ] **Step 8: Commit（migration + schema + 測試 + SCHEMA.md 同一個 commit）**

```bash
git add migrations/0063_add_broadcast_attachments.sql src/db/schema.ts tests/database/broadcast-migration.test.ts docs/architecture/SCHEMA.md
git commit -m "feat(broadcast): add broadcast_attachments table (migration 0063)"
```

---

### Task 2: 純函式：附件驗證與 LINE 訊息組裝

**Files:**
- Modify: `src/modules/broadcast/types/index.ts`
- Create: `src/modules/broadcast/services/broadcast-content.ts`
- Test: `tests/modules/broadcast/broadcast-content.test.ts`

**Interfaces:**
- Produces（types）：
  ```ts
  export type BroadcastContentType = 'text' | 'mixed';
  export interface BroadcastAttachmentInput { attachmentId: string; previewAttachmentId: string }
  export interface BroadcastAttachmentView { position: number; attachmentId: string; fileUrl: string; previewUrl: string }
  // CreateBroadcastInput 新增 attachments: BroadcastAttachmentInput[]
  // BroadcastRecord 新增 attachments?: BroadcastAttachmentView[]（僅 getById/create 回傳）
  ```
- Produces（functions，`broadcast-content.ts`）：
  - `BROADCAST_MAX_IMAGES = 4`、`BROADCAST_IMAGE_MAX_BYTES`、`BROADCAST_PREVIEW_MAX_BYTES`
  - `interface AttachmentCandidate { id: string; mimeType: string; fileSize: number; uploadedBy: string | null; messageId: string | null }`
  - `assertBroadcastAttachments(attachments: BroadcastAttachmentInput[], rows: AttachmentCandidate[], actorId: string): void`（違規 throw `BroadcastServiceError('INVALID_BROADCAST_INPUT', ..., 422)`）
  - `buildBroadcastLineMessages(content: string, images: Array<{ url: string; previewUrl: string }>): LineReplyMessage[]`

- [ ] **Step 1: 更新型別**

`src/modules/broadcast/types/index.ts`：

```ts
export type BroadcastContentType = 'text' | 'mixed';
```

在 `BroadcastAudiencePreview` 之後新增：

```ts
export interface BroadcastAttachmentInput {
  attachmentId: string;
  previewAttachmentId: string;
}

export interface BroadcastAttachmentView {
  position: number;
  attachmentId: string;
  fileUrl: string;
  previewUrl: string;
}
```

`CreateBroadcastInput` 改為（本 task 先設為選填，讓此 commit 可獨立編譯；Task 3 改為必填）：

```ts
export interface CreateBroadcastInput {
  title: string;
  content: string;
  tagIds: number[];
  attachments?: BroadcastAttachmentInput[];
}
```

`BroadcastRecord` 在 `deletedAt` 之後加：

```ts
  attachments?: BroadcastAttachmentView[];
```

- [ ] **Step 2: 寫失敗測試**

`tests/modules/broadcast/broadcast-content.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import {
  assertBroadcastAttachments,
  buildBroadcastLineMessages,
  type AttachmentCandidate,
} from '@/modules/broadcast/services/broadcast-content';

const MB = 1024 * 1024;

function row(id: string, overrides: Partial<AttachmentCandidate> = {}): AttachmentCandidate {
  return { id, mimeType: 'image/jpeg', fileSize: 500 * 1024, uploadedBy: 'agent-1', messageId: null, ...overrides };
}

const pair = (n: number) => ({ attachmentId: `img-${n}`, previewAttachmentId: `prev-${n}` });
const rowsFor = (...ns: number[]) => ns.flatMap((n) => [row(`img-${n}`, { fileSize: 8 * MB }), row(`prev-${n}`)]);

describe('assertBroadcastAttachments', () => {
  it('accepts zero to four owned, unattached images', () => {
    expect(() => assertBroadcastAttachments([], [], 'agent-1')).not.toThrow();
    expect(() => assertBroadcastAttachments([1, 2, 3, 4].map(pair), rowsFor(1, 2, 3, 4), 'agent-1')).not.toThrow();
  });

  it('rejects a fifth image', () => {
    expect(() => assertBroadcastAttachments([1, 2, 3, 4, 5].map(pair), rowsFor(1, 2, 3, 4, 5), 'agent-1'))
      .toThrow(/At most 4 images/);
  });

  it('rejects duplicate ids inside one broadcast', () => {
    const dup = [pair(1), { attachmentId: 'img-1', previewAttachmentId: 'prev-2' }];
    expect(() => assertBroadcastAttachments(dup, rowsFor(1, 2), 'agent-1')).toThrow(/unique/);
  });

  it('rejects missing rows', () => {
    expect(() => assertBroadcastAttachments([pair(1)], [row('img-1')], 'agent-1')).toThrow(/preview not found/);
  });

  it('rejects uploads owned by someone else', () => {
    const rows = [row('img-1', { uploadedBy: 'agent-2' }), row('prev-1')];
    expect(() => assertBroadcastAttachments([pair(1)], rows, 'agent-1')).toThrow(/not uploaded by you/);
  });

  it('rejects uploads already attached to a message', () => {
    const rows = [row('img-1', { messageId: 'msg-9' }), row('prev-1')];
    expect(() => assertBroadcastAttachments([pair(1)], rows, 'agent-1')).toThrow(/already attached/);
  });

  it('rejects non JPEG/PNG types', () => {
    const rows = [row('img-1', { mimeType: 'image/gif' }), row('prev-1')];
    expect(() => assertBroadcastAttachments([pair(1)], rows, 'agent-1')).toThrow(/JPEG or PNG/);
  });

  it('enforces 10MB original and 1MB preview limits', () => {
    expect(() => assertBroadcastAttachments([pair(1)], [row('img-1', { fileSize: 10 * MB + 1 }), row('prev-1')], 'agent-1'))
      .toThrow(/image exceeds/);
    expect(() => assertBroadcastAttachments([pair(1)], [row('img-1'), row('prev-1', { fileSize: MB + 1 })], 'agent-1'))
      .toThrow(/preview exceeds/);
  });
});

describe('buildBroadcastLineMessages', () => {
  const images = [
    { url: 'https://x/a.jpg', previewUrl: 'https://x/a-p.jpg' },
    { url: 'https://x/b.png', previewUrl: 'https://x/b-p.jpg' },
  ];

  it('puts text first, then images in order with their previews', () => {
    expect(buildBroadcastLineMessages('Hello', images)).toEqual([
      { type: 'text', text: 'Hello' },
      { type: 'image', originalContentUrl: 'https://x/a.jpg', previewImageUrl: 'https://x/a-p.jpg' },
      { type: 'image', originalContentUrl: 'https://x/b.png', previewImageUrl: 'https://x/b-p.jpg' },
    ]);
  });

  it('omits the text message for image-only broadcasts', () => {
    expect(buildBroadcastLineMessages('', images).map((m) => m.type)).toEqual(['image', 'image']);
  });

  it('returns a single text message for text-only broadcasts', () => {
    expect(buildBroadcastLineMessages('Hi', [])).toEqual([{ type: 'text', text: 'Hi' }]);
  });
});
```

- [ ] **Step 3: 執行確認失敗**

Run: `bunx vitest run tests/modules/broadcast/broadcast-content.test.ts`
Expected: FAIL，`Cannot find module '@/modules/broadcast/services/broadcast-content'`

- [ ] **Step 4: 實作**

`src/modules/broadcast/services/broadcast-content.ts`：

```ts
import type { LineReplyMessage } from '@/types';
import { createImageMessage, createTextMessage } from '@/utils/line';
import { BroadcastServiceError, type BroadcastAttachmentInput } from '@modules/broadcast/types';

// LINE multicast carries at most 5 message objects: 1 text + 4 images.
export const BROADCAST_MAX_IMAGES = 4;
export const BROADCAST_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
// LINE previewImageUrl limit; larger previews render as broken images client-side.
export const BROADCAST_PREVIEW_MAX_BYTES = 1024 * 1024;
const BROADCAST_IMAGE_MIME_TYPES: readonly string[] = ['image/jpeg', 'image/png'];

export interface AttachmentCandidate {
  id: string;
  mimeType: string;
  fileSize: number;
  uploadedBy: string | null;
  messageId: string | null;
}

export function assertBroadcastAttachments(
  attachments: BroadcastAttachmentInput[],
  rows: AttachmentCandidate[],
  actorId: string
): void {
  if (attachments.length > BROADCAST_MAX_IMAGES) {
    fail(`At most ${BROADCAST_MAX_IMAGES} images per broadcast`);
  }

  const ids = attachments.flatMap((item) => [item.attachmentId, item.previewAttachmentId]);
  if (new Set(ids).size !== ids.length) {
    fail('Attachment ids must be unique');
  }

  const byId = new Map(rows.map((candidate) => [candidate.id, candidate]));
  for (const item of attachments) {
    checkImage(byId.get(item.attachmentId), actorId, BROADCAST_IMAGE_MAX_BYTES, 'image');
    checkImage(byId.get(item.previewAttachmentId), actorId, BROADCAST_PREVIEW_MAX_BYTES, 'preview');
  }
}

export function buildBroadcastLineMessages(
  content: string,
  images: Array<{ url: string; previewUrl: string }>
): LineReplyMessage[] {
  const text = content ? [createTextMessage(content)] : [];
  return [...text, ...images.map((image) => createImageMessage(image.url, image.previewUrl))];
}

function checkImage(
  candidate: AttachmentCandidate | undefined,
  actorId: string,
  maxBytes: number,
  label: 'image' | 'preview'
): void {
  if (!candidate) {
    fail(`${label} not found`);
  }
  if (candidate.uploadedBy !== actorId) {
    fail(`${label} was not uploaded by you`);
  }
  if (candidate.messageId !== null) {
    fail(`${label} is already attached to a message`);
  }
  if (!BROADCAST_IMAGE_MIME_TYPES.includes(candidate.mimeType)) {
    fail(`${label} must be JPEG or PNG`);
  }
  if (candidate.fileSize > maxBytes) {
    fail(`${label} exceeds ${maxBytes} bytes`);
  }
}

function fail(message: string): never {
  throw new BroadcastServiceError('INVALID_BROADCAST_INPUT', message, 422);
}
```

- [ ] **Step 5: 執行確認通過**

Run: `bunx vitest run tests/modules/broadcast/broadcast-content.test.ts`
Expected: PASS（11 tests）

Run: `bunx tsc --noEmit`
Expected: 無錯誤（`attachments` 為選填，既有呼叫端不受影響）

- [ ] **Step 6: Commit**

```bash
git add src/modules/broadcast/types/index.ts src/modules/broadcast/services/broadcast-content.ts tests/modules/broadcast/broadcast-content.test.ts
git commit -m "feat(broadcast): attachment validation and LINE message builder"
```

---

### Task 3: 建立群發時接受並儲存附件

**Files:**
- Modify: `src/modules/broadcast/handlers/broadcast-main.ts:46-65, 149-177`
- Modify: `src/modules/broadcast/services/broadcast-service.ts`
- Modify: `src/modules/broadcast/types/index.ts`（`attachments` 改為必填）
- Test: `tests/modules/broadcast/broadcast-main.test.ts`

**Interfaces:**
- Consumes: `assertBroadcastAttachments`、`BroadcastAttachmentInput`、`BroadcastAttachmentView`、`broadcastAttachments` table。
- Produces:
  - `new BroadcastService(db: Database, env: Bindings)`（新增 env，用於簽 URL）
  - `BroadcastService.create(input: CreateBroadcastInput, createdBy: string): Promise<BroadcastRecord>`（結果含 `attachments`）
  - `BroadcastService.getById(id: string): Promise<BroadcastRecord | null>`（結果含 `attachments`）
  - `POST /api/broadcasts` body：`{ title, content, tagIds, attachments?: Array<{ attachmentId, previewAttachmentId }> }`

- [ ] **Step 1: 寫失敗的 handler 測試**

在 `tests/modules/broadcast/broadcast-main.test.ts`：把 `mocks` 擴充為 `vi.hoisted(() => ({ preview: vi.fn(), create: vi.fn() }))`，`BroadcastService` mock 回傳 `{ preview: mocks.preview, create: mocks.create }`，並新增：

```ts
describe('broadcast create route', () => {
  function buildApp() {
    const app = new Hono<{ Bindings: Bindings }>();
    app.use('*', async (c, next) => {
      c.env = { DB: {} } as Bindings;
      await next();
    });
    app.route('/api/broadcasts', broadcastRouter);
    return app;
  }

  function post(body: unknown) {
    return buildApp().request('/api/broadcasts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue({ id: 'b-1' });
  });

  it('accepts an image-only broadcast', async () => {
    const attachments = [{ attachmentId: 'img-1', previewAttachmentId: 'prev-1' }];
    const response = await post({ title: 'Promo', content: '', tagIds: [1], attachments });

    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(
      { title: 'Promo', content: '', tagIds: [1], attachments },
      'agent-1'
    );
  });

  it('defaults attachments to an empty list for text broadcasts', async () => {
    await post({ title: 'Promo', content: 'Hi', tagIds: [1] });
    expect(mocks.create).toHaveBeenCalledWith(
      { title: 'Promo', content: 'Hi', tagIds: [1], attachments: [] },
      'agent-1'
    );
  });

  it('rejects a broadcast with neither text nor images', async () => {
    const response = await post({ title: 'Promo', content: '  ', tagIds: [1] });
    expect(response.status).toBe(422);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('rejects malformed attachment entries', async () => {
    const response = await post({ title: 'Promo', content: 'Hi', tagIds: [1], attachments: [{ attachmentId: 'img-1' }] });
    expect(response.status).toBe(422);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
```

（`validationErrorResponse` 回傳 422，見 `src/utils/api-response.ts:103`。）

- [ ] **Step 2: 執行確認失敗**

Run: `bunx vitest run tests/modules/broadcast/broadcast-main.test.ts`
Expected: FAIL（`content must be 1-2000 characters` 拒絕空內容；`attachments` 未傳遞）

- [ ] **Step 3: 修改 handler 解析**

`broadcast-main.ts` 的 `parseCreateInput` 改為：

```ts
async function parseCreateInput(
  bodyPromise: Promise<unknown>
): Promise<
  | { ok: true; input: CreateBroadcastInput }
  | { ok: false; errors: Array<{ field: string; message: string; value?: unknown }> }
> {
  const errors: Array<{ field: string; message: string; value?: unknown }> = [];
  const body = await bodyPromise.catch(() => null);
  const record = isRecord(body) ? body : {};
  const title = typeof record.title === 'string' ? record.title.trim() : '';
  const content = typeof record.content === 'string' ? record.content.trim() : '';
  const parsedTagIds = parseTagIds(record);
  const parsedAttachments = parseAttachments(record.attachments);

  if (title.length < 1 || title.length > 100) {
    errors.push({ field: 'title', message: 'title must be 1-100 characters', value: record.title });
  }
  if (content.length > 2000) {
    errors.push({ field: 'content', message: 'content must be at most 2000 characters', value: record.content });
  }
  if (!parsedTagIds.ok) {
    errors.push({ field: 'tagIds', message: 'tagIds must be a non-empty array of positive integers' });
  }
  if (!parsedAttachments.ok) {
    errors.push({ field: 'attachments', message: 'attachments must be an array of { attachmentId, previewAttachmentId }' });
  } else if (content.length === 0 && parsedAttachments.attachments.length === 0) {
    errors.push({ field: 'content', message: 'content or at least one image is required' });
  }

  if (errors.length > 0 || !parsedTagIds.ok || !parsedAttachments.ok) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    input: { title, content, tagIds: parsedTagIds.tagIds, attachments: parsedAttachments.attachments },
  };
}

function parseAttachments(
  value: unknown
): { ok: true; attachments: BroadcastAttachmentInput[] } | { ok: false } {
  if (value === undefined) {
    return { ok: true, attachments: [] };
  }
  if (!Array.isArray(value)) {
    return { ok: false };
  }
  const attachments = value.filter(
    (item): item is BroadcastAttachmentInput =>
      isRecord(item) &&
      typeof item.attachmentId === 'string' && item.attachmentId.length > 0 &&
      typeof item.previewAttachmentId === 'string' && item.previewAttachmentId.length > 0
  ).map(({ attachmentId, previewAttachmentId }) => ({ attachmentId, previewAttachmentId }));
  return attachments.length === value.length ? { ok: true, attachments } : { ok: false };
}
```

並把 import 改為加入 `type BroadcastAttachmentInput`。所有 `new BroadcastService(createDbClient(c.env.DB))` 改為 `new BroadcastService(createDbClient(c.env.DB), c.env)`（共 5 處）。

- [ ] **Step 4: 修改 service**

`broadcast-service.ts`：

1. imports 加入：
```ts
import { inArray } from 'drizzle-orm';  // 併入既有 drizzle-orm import
import type { Bindings } from '@/types';
import { broadcastAttachments, fileAttachments } from '@/db/schema';  // 併入既有 schema import
import { getSignedFileUrl, PERSISTENT_ATTACHMENT_URL_TTL_SECONDS } from '@/utils/file-url';
import { assertBroadcastAttachments } from './broadcast-content';
import type { BroadcastAttachmentView } from '@modules/broadcast/types';  // 併入既有 types import
```

2. constructor：
```ts
  constructor(
    private readonly db: Database,
    private readonly env: Bindings
  ) {
    this.audienceService = new BroadcastAudienceService(db);
  }
```

3. `create` 中，`validateCreateInput(input);` 之後加入：
```ts
    await this.assertAttachments(input, createdBy);
```
`record.contentType` 改為 `input.attachments.length > 0 ? 'mixed' : 'text'`。
在 recipients 插入的 `for` 迴圈之後（同一個 try 內）加入：
```ts
      if (input.attachments.length > 0) {
        await this.db.insert(broadcastAttachments).values(
          input.attachments.map((item, position) => ({
            broadcastId,
            attachmentId: item.attachmentId,
            previewAttachmentId: item.previewAttachmentId,
            position,
            createdAt: now,
          }) satisfies typeof broadcastAttachments.$inferInsert)
        );
      }
```
（最多 4 列 × 5 欄 = 20 參數，低於 D1 100 上限，不需分批。）

4. `getById` 改為：
```ts
  async getById(id: string): Promise<BroadcastRecord | null> {
    const row = await this.db.query.broadcasts.findFirst({
      where: and(eq(broadcasts.id, id), isNull(broadcasts.deletedAt)),
    });
    if (!row) {
      return null;
    }
    return { ...mapBroadcastRecord(row), attachments: await this.loadAttachments(id) };
  }
```

5. 新增私有方法：
```ts
  private async assertAttachments(input: CreateBroadcastInput, actorId: string): Promise<void> {
    if (input.attachments.length === 0) {
      return;
    }
    const ids = input.attachments.flatMap((item) => [item.attachmentId, item.previewAttachmentId]);
    const rows = await this.db
      .select({
        id: fileAttachments.id,
        mimeType: fileAttachments.mimeType,
        fileSize: fileAttachments.fileSize,
        uploadedBy: fileAttachments.uploadedBy,
        messageId: fileAttachments.messageId,
      })
      .from(fileAttachments)
      .where(inArray(fileAttachments.id, ids));
    assertBroadcastAttachments(input.attachments, rows, actorId);
  }

  private async loadAttachments(broadcastId: string): Promise<BroadcastAttachmentView[]> {
    const rows = await this.db
      .select({
        position: broadcastAttachments.position,
        attachmentId: broadcastAttachments.attachmentId,
        previewAttachmentId: broadcastAttachments.previewAttachmentId,
      })
      .from(broadcastAttachments)
      .where(eq(broadcastAttachments.broadcastId, broadcastId))
      .orderBy(asc(broadcastAttachments.position));
    if (rows.length === 0) {
      return [];
    }

    const files = await this.db
      .select({ id: fileAttachments.id, r2Key: fileAttachments.r2Key })
      .from(fileAttachments)
      .where(inArray(fileAttachments.id, rows.flatMap((r) => [r.attachmentId, r.previewAttachmentId])));
    const keyById = new Map(files.map((file) => [file.id, file.r2Key]));
    const sign = (fileId: string) =>
      getSignedFileUrl(this.env, keyById.get(fileId) ?? '', PERSISTENT_ATTACHMENT_URL_TTL_SECONDS);

    return Promise.all(rows.map(async (r) => ({
      position: r.position,
      attachmentId: r.attachmentId,
      fileUrl: await sign(r.attachmentId),
      previewUrl: await sign(r.previewAttachmentId),
    })));
  }
```

6. `validateCreateInput` 的 content 檢查改為：
```ts
  if (content.length > 2000) {
    throw new BroadcastServiceError('INVALID_BROADCAST_INPUT', 'Broadcast content must be at most 2000 characters', 422);
  }
  if (content.length === 0 && input.attachments.length === 0) {
    throw new BroadcastServiceError('INVALID_BROADCAST_INPUT', 'Broadcast needs text or at least one image', 422);
  }
```

7. `types/index.ts`：`CreateBroadcastInput.attachments?:` 改為必填 `attachments:`。

8. `tests/modules/broadcast/broadcast-service.test.ts`：兩處 `new BroadcastService(db)` 改為 `new BroadcastService(db, {} as Bindings)`，並 `import type { Bindings } from '@/types';`。

- [ ] **Step 5: 執行確認通過**

Run: `bunx vitest run tests/modules/broadcast`
Expected: PASS
Run: `bunx tsc --noEmit`
Expected: 無錯誤

- [ ] **Step 6: Commit**

```bash
git add src/modules/broadcast tests/modules/broadcast
git commit -m "feat(broadcast): accept up to 4 images when creating a broadcast"
```

---

### Task 4: 送出圖片並回寫到對話紀錄

**Files:**
- Modify: `src/modules/broadcast/services/broadcast-sender-service.ts`
- Modify: `src/modules/broadcast/services/d1-chunks.ts`
- Modify: `src/modules/broadcast/services/broadcast-content.ts`（新增回寫列組裝函式）
- Test: `tests/modules/broadcast/broadcast-content.test.ts`

**Interfaces:**
- Consumes: `buildBroadcastLineMessages`、`broadcastAttachments`。
- Produces:
  - `interface BroadcastImageFile { filename: string; mimeType: string; fileSize: number; r2Key: string; url: string }`
  - `buildWriteBackAttachmentRows(messageId: string, conversationId: string, images: BroadcastImageFile[], uploadedBy: string, createdAt: string): Array<typeof fileAttachments.$inferInsert>`
  - `BROADCAST_ATTACHMENT_INSERT_CHUNK_SIZE = 9`（11 欄 × 9 = 99 ≤ 100 參數）

- [ ] **Step 1: 寫失敗測試**

附加到 `tests/modules/broadcast/broadcast-content.test.ts`：

```ts
import { buildWriteBackAttachmentRows } from '@/modules/broadcast/services/broadcast-content';

describe('buildWriteBackAttachmentRows', () => {
  it('creates one attachment row per image bound to the recipient message, sharing the r2Key', () => {
    const images = [
      { filename: 'a.jpg', mimeType: 'image/jpeg', fileSize: 10, r2Key: 'k/a.jpg', url: 'https://x/a' },
      { filename: 'b.png', mimeType: 'image/png', fileSize: 20, r2Key: 'k/b.png', url: 'https://x/b' },
    ];
    const rows = buildWriteBackAttachmentRows('msg-1', 'conv-1', images, 'agent-1', '2026-10-06T00:00:00.000Z');

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      messageId: 'msg-1',
      conversationId: 'conv-1',
      filename: 'a.jpg',
      mimeType: 'image/jpeg',
      fileSize: 10,
      r2Key: 'k/a.jpg',
      fileUrl: 'https://x/a',
      uploadedBy: 'agent-1',
      uploadStatus: 'completed',
    });
    expect(rows[1].r2Key).toBe('k/b.png');
    expect(new Set(rows.map((r) => r.id)).size).toBe(2);
  });
});
```

- [ ] **Step 2: 執行確認失敗**

Run: `bunx vitest run tests/modules/broadcast/broadcast-content.test.ts`
Expected: FAIL，`buildWriteBackAttachmentRows is not a function`

- [ ] **Step 3: 實作組裝函式與 chunk 常數**

`broadcast-content.ts` 加入：

```ts
import type { fileAttachments } from '@/db/schema';

export interface BroadcastImageFile {
  filename: string;
  mimeType: string;
  fileSize: number;
  r2Key: string;
  url: string;
}

// ponytail: rows share the original r2Key; FileService.deleteFile only removes
// the R2 object once no row references it.
export function buildWriteBackAttachmentRows(
  messageId: string,
  conversationId: string,
  images: BroadcastImageFile[],
  uploadedBy: string,
  createdAt: string
): Array<typeof fileAttachments.$inferInsert> {
  return images.map((image) => ({
    id: crypto.randomUUID(),
    messageId,
    conversationId,
    filename: image.filename,
    mimeType: image.mimeType,
    fileSize: image.fileSize,
    fileUrl: image.url,
    r2Key: image.r2Key,
    uploadStatus: 'completed',
    uploadedBy,
    createdAt,
  }));
}
```

`d1-chunks.ts` 加入：

```ts
export const BROADCAST_ATTACHMENT_INSERT_CHUNK_SIZE = 9;
```

- [ ] **Step 4: 執行確認通過**

Run: `bunx vitest run tests/modules/broadcast/broadcast-content.test.ts`
Expected: PASS

- [ ] **Step 5: 接上 sender**

`broadcast-sender-service.ts`：

1. imports：從 `@/db/schema` 加入 `broadcastAttachments, fileAttachments`；從 `drizzle-orm` 加入 `asc`；移除 `createTextMessage`；加入：
```ts
import type { LineReplyMessage } from '@/types';
import { getSignedFileUrl, PERSISTENT_ATTACHMENT_URL_TTL_SECONDS } from '@/utils/file-url';
import {
  buildBroadcastLineMessages,
  buildWriteBackAttachmentRows,
  type BroadcastImageFile,
} from './broadcast-content';
```
`d1-chunks` import 加入 `BROADCAST_ATTACHMENT_INSERT_CHUNK_SIZE`。

2. 在 `send()` 的 `try {` 一開始加入：
```ts
      const images = await this.loadImages(broadcastId);
      const lineMessages = buildBroadcastLineMessages(broadcast.content, images);
```

3. `this.sendLineGroup(group, broadcast.content)` 改為 `this.sendLineGroup(group, lineMessages)`；`sendLineGroup` 簽名改為 `(group: TokenGroup, lineMessages: LineReplyMessage[])`，內部 `[createTextMessage(content)]` 改為 `lineMessages`。

4. `this.writeBackConversationMessages(broadcastId, broadcast.content, actor, sentRecipients)` 改為 `this.writeBackConversationMessages(broadcastId, broadcast.content, images, actor, sentRecipients)`。

5. 新增私有方法：
```ts
  private async loadImages(broadcastId: string): Promise<Array<BroadcastImageFile & { previewUrl: string }>> {
    const links = await this.db
      .select({
        attachmentId: broadcastAttachments.attachmentId,
        previewAttachmentId: broadcastAttachments.previewAttachmentId,
      })
      .from(broadcastAttachments)
      .where(eq(broadcastAttachments.broadcastId, broadcastId))
      .orderBy(asc(broadcastAttachments.position));
    if (links.length === 0) {
      return [];
    }

    const files = await this.db
      .select()
      .from(fileAttachments)
      .where(inArray(fileAttachments.id, links.flatMap((l) => [l.attachmentId, l.previewAttachmentId])));
    const byId = new Map(files.map((file) => [file.id, file]));
    const sign = (r2Key: string) => getSignedFileUrl(this.env, r2Key, PERSISTENT_ATTACHMENT_URL_TTL_SECONDS);

    return Promise.all(links.map(async (link) => {
      const original = byId.get(link.attachmentId);
      const preview = byId.get(link.previewAttachmentId);
      if (!original || !preview) {
        throw new Error(`Broadcast ${broadcastId} references a missing attachment`);
      }
      return {
        filename: original.filename,
        mimeType: original.mimeType,
        fileSize: original.fileSize,
        r2Key: original.r2Key,
        url: await sign(original.r2Key),
        previewUrl: await sign(preview.r2Key),
      };
    }));
  }
```
（缺附件時丟一般 Error → 既有 catch 會把剩餘收件人標記 failed 並 finalize，LINE 不會被呼叫。）

6. `writeBackConversationMessages` 簽名加入 `images: BroadcastImageFile[]`（在 `content` 後），`messageRows` 的物件改為：
```ts
        messageType: images.length > 0 ? 'file' : 'text',
```
（其餘欄位、含 `metadata: JSON.stringify({ broadcastId })`，皆不變；渲染端以 `file_attachments.messageId` JOIN，不讀 metadata。）在 messages 插入迴圈之後加入：
```ts
    if (images.length > 0 && messageRows.length > 0) {
      const attachmentRows = messageRows.flatMap((message) =>
        buildWriteBackAttachmentRows(message.id, message.conversationId, images, String(actor.id), timestamp)
      );
      for (const attachmentChunk of chunkItems(attachmentRows, BROADCAST_ATTACHMENT_INSERT_CHUNK_SIZE)) {
        await this.db.insert(fileAttachments).values(attachmentChunk);
      }
    }
```
（必須在 messages 插入之後：`file_attachments.message_id` 有 FK。）

- [ ] **Step 6: 型別檢查與測試**

Run: `bunx tsc --noEmit` → 無錯誤
Run: `bunx vitest run tests/modules/broadcast` → PASS

- [ ] **Step 7: Commit**

```bash
git add src/modules/broadcast tests/modules/broadcast
git commit -m "feat(broadcast): send images via LINE multicast and write them back to conversations"
```

---

### Task 5: deleteFile 不刪共用的 R2 物件

**Files:**
- Modify: `src/modules/file-management/services/file-service.ts:285-316`
- Test: `tests/unit/modules/file-management/file-service-delete-shared-key.test.ts`

**Interfaces:**
- Produces: `FileService.deleteFile(fileId, userId?)` 行為：先刪 DB 列（FK RESTRICT 失敗則 R2 不動），再於無其他列引用同一 `r2Key` 時刪 R2。

- [ ] **Step 1: 確認建構方式**

Run: `grep -n "constructor" -A 12 src/modules/file-management/services/file-service.ts`
確認 `this.db` 與 `this.storageService` 的來源（`createDbClient(env.DB)` 與 `createStorageService(env)`），測試以 `vi.mock` 取代這兩個 factory。

- [ ] **Step 2: 寫失敗測試**

`tests/unit/modules/file-management/file-service-delete-shared-key.test.ts`：

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '@/types';

const state = vi.hoisted(() => ({
  record: { id: 'f-1', r2Key: 'k/shared.jpg' } as { id: string; r2Key: string } | undefined,
  remainingRefs: 0,
  deleteDbError: null as Error | null,
  storageDelete: vi.fn(async () => true),
  dbDelete: vi.fn(),
}));

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => {
    let selectCalls = 0;
    return {
      select: vi.fn(() => {
        selectCalls += 1;
        const call = selectCalls;
        return {
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              get: vi.fn(async () => (call === 1 ? state.record : { n: state.remainingRefs })),
            })),
          })),
        };
      }),
      delete: vi.fn(() => ({
        where: vi.fn(async () => {
          state.dbDelete();
          if (state.deleteDbError) throw state.deleteDbError;
        }),
      })),
    };
  }),
}));

vi.mock('@modules/file-management/services/storage-service', () => ({
  createStorageService: vi.fn(() => ({ deleteFile: state.storageDelete })),
}));

import { FileService } from '@/modules/file-management/services/file-service';

describe('FileService.deleteFile with shared r2Key', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.record = { id: 'f-1', r2Key: 'k/shared.jpg' };
    state.remainingRefs = 0;
    state.deleteDbError = null;
  });

  it('deletes the R2 object when no other row references the key', async () => {
    const result = await new FileService({} as Bindings).deleteFile('f-1');
    expect(result.success).toBe(true);
    expect(state.dbDelete).toHaveBeenCalledTimes(1);
    expect(state.storageDelete).toHaveBeenCalledWith('k/shared.jpg');
  });

  it('keeps the R2 object while another row still references the key', async () => {
    state.remainingRefs = 3;
    const result = await new FileService({} as Bindings).deleteFile('f-1');
    expect(result.success).toBe(true);
    expect(state.storageDelete).not.toHaveBeenCalled();
  });

  it('leaves R2 untouched when the DB delete is blocked by a foreign key', async () => {
    state.deleteDbError = new Error('FOREIGN KEY constraint failed');
    const result = await new FileService({} as Bindings).deleteFile('f-1');
    expect(result.success).toBe(false);
    expect(state.storageDelete).not.toHaveBeenCalled();
  });
});
```

（若 Step 1 發現 constructor 尚建立其他依賴（如 `FileValidationService`、`MetadataService`）會讀 env，對應 `vi.mock` 回傳空物件即可。）

- [ ] **Step 3: 執行確認失敗**

Run: `bunx vitest run tests/unit/modules/file-management/file-service-delete-shared-key.test.ts`
Expected: FAIL（第 2、3 個測試：目前先刪 R2 再刪 DB）

- [ ] **Step 4: 實作**

把 `deleteFile` 中「從儲存服務刪除檔案」到「從資料庫刪除記錄」兩段替換為：

```ts
      // DB first: a FK RESTRICT (e.g. broadcast_attachments) must abort before R2 is touched.
      await this.db
        .delete(fileAttachments)
        .where(eq(fileAttachments.id, fileId));

      // Broadcast write-back rows share one r2Key across recipients; only the last reference deletes the object.
      const stillReferenced = await this.db
        .select({ n: sql<number>`count(*)` })
        .from(fileAttachments)
        .where(eq(fileAttachments.r2Key, fileRecord.r2Key))
        .get();

      if ((stillReferenced?.n ?? 0) === 0) {
        const deleteSuccess = await this.storageService.deleteFile(fileRecord.r2Key);
        if (!deleteSuccess) {
          log.warn('Failed to delete file from storage after removing its last reference');
        }
      }
```

- [ ] **Step 5: 執行確認通過**

Run: `bunx vitest run tests/unit/modules/file-management/file-service-delete-shared-key.test.ts` → PASS
Run: `bunx vitest run tests/unit/modules/file-management` → PASS（既有測試無回歸）
Run: `bunx tsc --noEmit` → 無錯誤

- [ ] **Step 6: Commit**

```bash
git add src/modules/file-management/services/file-service.ts tests/unit/modules/file-management/file-service-delete-shared-key.test.ts
git commit -m "fix(files): keep R2 objects that other attachment rows still reference"
```

---

### Task 6: 前端預覽圖產生器

**Files:**
- Create: `frontend/src/utils/broadcast-image-preview.ts`
- Test: `frontend/src/utils/broadcast-image-preview.test.ts`

**Interfaces:**
- Produces:
  - `PREVIEW_MAX_BYTES = 1024 * 1024`、`PREVIEW_MAX_EDGE = 1024`
  - `type JpegEncoder = (quality: number) => Promise<Blob>`
  - `encodeUnderLimit(encode: JpegEncoder, maxBytes?: number): Promise<Blob>`（品質 0.85 起、每次 -0.15、最低 0.4；仍超過則 throw）
  - `scaleToFit(width: number, height: number, maxEdge?: number): { width: number; height: number }`
  - `createBroadcastPreview(file: File): Promise<File>`（瀏覽器 canvas，回傳 `preview-<原檔名去副檔名>.jpg`）

- [ ] **Step 1: 寫失敗測試**

`frontend/src/utils/broadcast-image-preview.test.ts`：

```ts
import { describe, expect, it, vi } from 'vitest'
import { encodeUnderLimit, scaleToFit, PREVIEW_MAX_BYTES } from './broadcast-image-preview'

const blobOf = (bytes: number) => new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' })

describe('scaleToFit', () => {
  it('keeps small images unchanged', () => {
    expect(scaleToFit(800, 600)).toEqual({ width: 800, height: 600 })
  })

  it('scales the long edge down to 1024 preserving ratio', () => {
    expect(scaleToFit(4000, 2000)).toEqual({ width: 1024, height: 512 })
    expect(scaleToFit(1500, 3000)).toEqual({ width: 512, height: 1024 })
  })
})

describe('encodeUnderLimit', () => {
  it('returns the first encoding that fits', async () => {
    const encode = vi.fn(async () => blobOf(200_000))
    const blob = await encodeUnderLimit(encode)
    expect(blob.size).toBe(200_000)
    expect(encode).toHaveBeenCalledWith(0.85)
    expect(encode).toHaveBeenCalledTimes(1)
  })

  it('lowers quality until the preview fits under 1MB', async () => {
    const encode = vi.fn(async (q: number) => blobOf(q > 0.6 ? PREVIEW_MAX_BYTES + 1 : 900_000))
    const blob = await encodeUnderLimit(encode)
    expect(blob.size).toBe(900_000)
    expect(encode.mock.calls.map(([q]) => Number(q.toFixed(2)))).toEqual([0.85, 0.7, 0.55])
  })

  it('throws when even the lowest quality is too large', async () => {
    const encode = vi.fn(async () => blobOf(PREVIEW_MAX_BYTES + 1))
    await expect(encodeUnderLimit(encode)).rejects.toThrow('預覽圖無法壓縮到 1MB 以下')
  })
})
```

- [ ] **Step 2: 執行確認失敗**

Run（於 `frontend/`）: `bunx vitest run src/utils/broadcast-image-preview.test.ts`
Expected: FAIL，模組不存在

- [ ] **Step 3: 實作**

`frontend/src/utils/broadcast-image-preview.ts`：

```ts
// LINE previewImageUrl must be <= 1MB JPEG/PNG; larger previews show as broken images.
export const PREVIEW_MAX_BYTES = 1024 * 1024
export const PREVIEW_MAX_EDGE = 1024

const START_QUALITY = 0.85
const QUALITY_STEP = 0.15
const MIN_QUALITY = 0.4

export type JpegEncoder = (quality: number) => Promise<Blob>

export function scaleToFit(width: number, height: number, maxEdge = PREVIEW_MAX_EDGE) {
  const ratio = Math.min(1, maxEdge / Math.max(width, height))
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) }
}

export async function encodeUnderLimit(encode: JpegEncoder, maxBytes = PREVIEW_MAX_BYTES): Promise<Blob> {
  for (let quality = START_QUALITY; quality >= MIN_QUALITY - 1e-9; quality -= QUALITY_STEP) {
    const blob = await encode(quality)
    if (blob.size <= maxBytes) {return blob}
  }
  throw new Error('預覽圖無法壓縮到 1MB 以下')
}

export async function createBroadcastPreview(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = scaleToFit(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {throw new Error('瀏覽器不支援圖片處理')}
  // JPEG has no alpha: paint white so transparent PNG areas do not turn black.
  context.fillStyle = '#FFFFFF'
  context.fillRect(0, 0, width, height)
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await encodeUnderLimit((quality) => new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('預覽圖產生失敗'))), 'image/jpeg', quality)
  }))
  const baseName = file.name.replace(/\.[^.]+$/, '')
  return new File([blob], `preview-${baseName}.jpg`, { type: 'image/jpeg' })
}
```

- [ ] **Step 4: 執行確認通過**

Run（於 `frontend/`）: `bunx vitest run src/utils/broadcast-image-preview.test.ts` → PASS（5 tests）
Run（於 `frontend/`）: `bun run type-check` → 無錯誤

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/broadcast-image-preview.ts frontend/src/utils/broadcast-image-preview.test.ts
git commit -m "feat(broadcast): generate <=1MB LINE preview images in the browser"
```

---

### Task 7: 群發表單圖片上傳 UI 與詳情縮圖

**Files:**
- Modify: `frontend/src/api/broadcasts.ts`
- Modify: `frontend/src/components/broadcast/BroadcastComposeCard.vue`
- Modify: `frontend/src/components/broadcast/BroadcastDetailModal.vue`
- Modify: `frontend/src/components/broadcast/BroadcastHistoryList.vue:53-56`
- Test: `frontend/src/components/broadcast/BroadcastComposeCard.test.ts`

**Interfaces:**
- Consumes: `createBroadcastPreview`（Task 6）、`filesApi.uploadFile`（`frontend/src/api/files.ts:22`，回傳 `ApiResponse<FileUploadResponse>`，id 欄位為 `fileId`）、`POST /api/broadcasts` 的 `attachments`（Task 3）。
- Produces:
  - `interface BroadcastAttachmentInput { attachmentId: string; previewAttachmentId: string }`
  - `interface BroadcastAttachmentView { position: number; attachmentId: string; fileUrl: string; previewUrl: string }`
  - `uploadBroadcastImage(file: File): Promise<BroadcastAttachmentInput>`
  - `CreateBroadcastRequest.attachments: BroadcastAttachmentInput[]`
  - `BroadcastRecord.contentType: 'text' | 'mixed'`、`BroadcastRecord.attachments?: BroadcastAttachmentView[]`

- [ ] **Step 1: 擴充 API 層**

`frontend/src/api/broadcasts.ts`：

```ts
import { filesApi } from './files'
import { createBroadcastPreview } from '@/utils/broadcast-image-preview'

export interface BroadcastAttachmentInput {
  attachmentId: string
  previewAttachmentId: string
}

export interface BroadcastAttachmentView {
  position: number
  attachmentId: string
  fileUrl: string
  previewUrl: string
}
```

`BroadcastRecord` 中 `contentType: 'text'` 改為 `contentType: 'text' | 'mixed'`，並加 `attachments?: BroadcastAttachmentView[]`。
`CreateBroadcastRequest` 加 `attachments: BroadcastAttachmentInput[]`。
檔尾新增：

```ts
async function uploadOne(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await filesApi.uploadFile(formData)
  if (!response.success || !response.data) {
    throw new Error(response.error || '圖片上傳失敗')
  }
  return response.data.fileId
}

export async function uploadBroadcastImage(file: File): Promise<BroadcastAttachmentInput> {
  const preview = await createBroadcastPreview(file)
  const [attachmentId, previewAttachmentId] = await Promise.all([uploadOne(file), uploadOne(preview)])
  return { attachmentId, previewAttachmentId }
}
```

- [ ] **Step 2: 寫失敗的元件測試**

`frontend/src/components/broadcast/BroadcastComposeCard.test.ts`：

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import BroadcastComposeCard from './BroadcastComposeCard.vue'

const upload = vi.hoisted(() => vi.fn())
vi.mock('@/api/broadcasts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/broadcasts')>()),
  uploadBroadcastImage: upload
}))

const preview = { total: 3, byPlatform: { line: 3, facebook: 0 }, sendable: 3, skipped: [] }

function mountCard() {
  return mount(BroadcastComposeCard, {
    props: {
      tags: [{ id: 7, name: 'VIP' }] as never,
      preview,
      previewTagId: 7,
      previewLoading: false,
      sending: false,
      error: null
    }
  })
}

const image = (name: string, type = 'image/jpeg', size = 1000) =>
  new File([new Uint8Array(size)], name, { type })

async function pick(wrapper: ReturnType<typeof mountCard>, files: File[]) {
  const input = wrapper.find('input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: files, configurable: true })
  await input.trigger('change')
  await flushPromises()
}

describe('BroadcastComposeCard images', () => {
  beforeEach(() => {
    upload.mockReset()
    upload.mockImplementation(async (file: File) => ({ attachmentId: `a-${file.name}`, previewAttachmentId: `p-${file.name}` }))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('sends image-only broadcasts with attachments in picked order', async () => {
    const wrapper = mountCard()
    await wrapper.find('input[type="text"]').setValue('Promo')
    await wrapper.find('select').setValue(7)
    await pick(wrapper, [image('1.jpg'), image('2.png', 'image/png')])
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('send')?.[0]?.[0]).toEqual({
      title: 'Promo',
      content: '',
      tagIds: [7],
      attachments: [
        { attachmentId: 'a-1.jpg', previewAttachmentId: 'p-1.jpg' },
        { attachmentId: 'a-2.png', previewAttachmentId: 'p-2.png' }
      ]
    })
  })

  it('caps the selection at 4 images', async () => {
    const wrapper = mountCard()
    await pick(wrapper, ['1', '2', '3', '4', '5'].map((n) => image(`${n}.jpg`)))
    expect(upload).toHaveBeenCalledTimes(4)
    expect(wrapper.text()).toContain('超出的已略過')
    expect(wrapper.find('input[type="file"]').exists()).toBe(false)
  })

  it('rejects non JPEG/PNG and files over 10MB without uploading', async () => {
    const wrapper = mountCard()
    await pick(wrapper, [image('a.gif', 'image/gif'), image('big.jpg', 'image/jpeg', 10 * 1024 * 1024 + 1)])
    expect(upload).not.toHaveBeenCalled()
  })

  it('blocks submit while nothing but a title is filled in', async () => {
    const wrapper = mountCard()
    await wrapper.find('input[type="text"]').setValue('Promo')
    await wrapper.find('select').setValue(7)
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
  })
})
```

- [ ] **Step 3: 執行確認失敗**

Run（於 `frontend/`）: `bunx vitest run src/components/broadcast/BroadcastComposeCard.test.ts`
Expected: FAIL（找不到 `input[type="file"]`）

- [ ] **Step 4: 實作表單**

`BroadcastComposeCard.vue`：

Template —— 把「訊息內容」`<label class="field">` 的 textarea 移除 `required`，placeholder 改為 `輸入文字（選填，可只發圖片）`；在其後、`preview-panel` 之前插入：

```vue
      <div class="field">
        <span>圖片（選填，最多 4 張，JPEG / PNG，每張 10MB 以內）</span>
        <ul
          v-if="images.length"
          class="image-grid"
        >
          <li
            v-for="(image, index) in images"
            :key="image.key"
            class="image-tile"
          >
            <img
              :src="image.objectUrl"
              :alt="`圖片 ${index + 1}`"
            >
            <span
              v-if="image.status === 'uploading'"
              class="tile-state"
            >上傳中...</span>
            <span
              v-else-if="image.status === 'error'"
              class="tile-state is-error"
            >{{ image.error }}</span>
            <div class="tile-actions">
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                :disabled="index === 0"
                :aria-label="`將圖片 ${index + 1} 往前移`"
                @click="move(index, -1)"
              >
                前移
              </button>
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                :aria-label="`移除圖片 ${index + 1}`"
                @click="remove(index)"
              >
                移除
              </button>
            </div>
          </li>
        </ul>
        <label
          v-if="images.length < MAX_IMAGES"
          class="btn btn-secondary btn-sm image-picker"
        >
          加入圖片
          <input
            type="file"
            accept="image/jpeg,image/png"
            multiple
            class="visually-hidden"
            @change="onPick"
          >
        </label>
        <small v-if="imageNotice">{{ imageNotice }}</small>
      </div>
```

Script —— 在既有 imports 下加入並調整：

```ts
import { computed, onBeforeUnmount, ref } from 'vue'
import { uploadBroadcastImage, type BroadcastAttachmentInput } from '@/api/broadcasts'

const MAX_IMAGES = 4
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const ACCEPTED_TYPES = ['image/jpeg', 'image/png']

interface PickedImage {
  key: string
  objectUrl: string
  status: 'uploading' | 'done' | 'error'
  attachment?: BroadcastAttachmentInput
  error?: string
}

const images = ref<PickedImage[]>([])
const imageNotice = ref('')

async function onPick(event: Event) {
  const input = event.target as HTMLInputElement
  const picked = Array.from(input.files ?? [])
  input.value = ''
  imageNotice.value = ''

  const valid = picked.filter((file) => ACCEPTED_TYPES.includes(file.type) && file.size <= MAX_IMAGE_BYTES)
  if (valid.length < picked.length) {
    imageNotice.value = '僅接受 10MB 以內的 JPEG / PNG 圖片'
  }
  const room = MAX_IMAGES - images.value.length
  if (valid.length > room) {
    imageNotice.value = '最多 4 張圖片，超出的已略過'
  }

  await Promise.all(valid.slice(0, room).map(async (file) => {
    const image: PickedImage = { key: crypto.randomUUID(), objectUrl: URL.createObjectURL(file), status: 'uploading' }
    images.value.push(image)
    const target = () => images.value.find((item) => item.key === image.key)
    try {
      const attachment = await uploadBroadcastImage(file)
      Object.assign(target() ?? {}, { status: 'done', attachment })
    } catch (err) {
      Object.assign(target() ?? {}, { status: 'error', error: err instanceof Error ? err.message : '上傳失敗' })
    }
  }))
}

function remove(index: number) {
  const [removed] = images.value.splice(index, 1)
  if (removed) {URL.revokeObjectURL(removed.objectUrl)}
}

function move(index: number, delta: number) {
  const next = index + delta
  if (next < 0 || next >= images.value.length) {return}
  const list = images.value
  ;[list[index], list[next]] = [list[next], list[index]]
}

onBeforeUnmount(() => images.value.forEach((image) => URL.revokeObjectURL(image.objectUrl)))

const imagesReady = computed(() => images.value.every((image) => image.status === 'done'))
```

`input` computed 改為：

```ts
const input = computed<CreateBroadcastRequest>(() => ({
  title: title.value,
  content: content.value,
  tagIds: selectedTagId.value ? [selectedTagId.value] : [],
  attachments: images.value.flatMap((image) => (image.attachment ? [image.attachment] : []))
}))
```

`canSubmit` 改為：

```ts
const canSubmit = computed(() =>
  title.value.length > 0 &&
  (content.value.length > 0 || images.value.length > 0) &&
  imagesReady.value &&
  selectedTagId.value > 0 &&
  currentPreview.value?.sendable &&
  currentPreview.value.sendable > 0
)
```

`handleSubmit` 的 confirm 文案改為：

```ts
  const parts = [content.value ? '文字' : '', images.value.length ? `${images.value.length} 張圖片` : ''].filter(Boolean)
  const confirmed = window.confirm(
    `即將發送「${parts.join(' + ')}」給 ${currentPreview.value?.sendable ?? 0} 位 LINE 客戶，送出後無法復原。`
  )
```

Style —— 加入（不重定義 `.btn*`）：

```css
.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.image-tile {
  position: relative;
  display: grid;
  gap: var(--space-2);
  padding: var(--space-2);
  border-radius: 14px;
  background: #f2f2f7;
}

.image-tile img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 10px;
}

.tile-state {
  font-size: var(--text-sm);
  font-weight: 500;
  color: #8e8e93;
}

.tile-state.is-error {
  color: #ff3b30;
}

.tile-actions {
  display: flex;
  justify-content: space-between;
}

.image-picker {
  justify-self: start;
  cursor: pointer;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
```

（`frontend/src/style.css` 沒有全域 visually-hidden utility，所以這裡在元件內定義。）

- [ ] **Step 5: 詳情與歷史顯示**

`BroadcastDetailModal.vue`，在 `</header>` 之後插入：

```vue
      <div
        v-if="broadcast?.attachments?.length"
        class="attachment-strip"
        aria-label="群發圖片"
      >
        <a
          v-for="item in broadcast.attachments"
          :key="item.attachmentId"
          :href="item.fileUrl"
          target="_blank"
          rel="noopener"
        >
          <img
            :src="item.previewUrl"
            :alt="`群發圖片 ${item.position + 1}`"
            loading="lazy"
          >
        </a>
      </div>
```

style 加入：

```css
.attachment-strip {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-4);
}

.attachment-strip img {
  width: 72px;
  height: 72px;
  object-fit: cover;
  border-radius: 12px;
}
```

`BroadcastHistoryList.vue:55` 的 `<small>{{ broadcast.content }}</small>` 改為：

```vue
              <small>
                <span
                  v-if="broadcast.contentType === 'mixed'"
                  class="mixed-pill"
                >圖文</span>
                {{ broadcast.content || '（僅圖片）' }}
              </small>
```

style 加入：

```css
.mixed-pill {
  display: inline-block;
  margin-right: var(--space-1);
  padding: 0 var(--space-2);
  border-radius: 999px;
  background: #e5f1ff;
  color: #007aff;
  font-weight: 600;
}
```

（`BroadcastView.vue:92` 的 `openDetail` 已呼叫 `fetchBroadcast(id)`（走 `getById`，含 `attachments`），不需改 view。）

- [ ] **Step 6: 執行確認通過**

Run（於 `frontend/`）: `bunx vitest run src/components/broadcast` → PASS
Run（於 `frontend/`）: `bun run type-check` → 無錯誤
Run（於 `frontend/`）: `bun run lint` → 無錯誤
Run（repo root）: `bun run lint:scoped-btn` → 通過

- [ ] **Step 7: Commit**

```bash
git add frontend/src/api/broadcasts.ts frontend/src/components/broadcast
git commit -m "feat(broadcast): image picker with previews in the compose form"
```

---

### Task 8: 全面驗證、真機驗收、部署

**Files:** 無程式碼變更（除非驗收發現問題）

- [ ] **Step 1: 全量檢查**

Run: `bash scripts/check.sh` → backend + frontend 全綠
Run: `bun run test:backend:ci` → PASS
Run（於 `frontend/`）: `bun run test` → PASS

- [ ] **Step 2: 變更範圍確認**

用 codebase-memory `detect_changes`（project `D-Code-Multi_Channel_Integration_System`）確認受影響範圍僅限 broadcast、file-service、schema、前端 broadcast 元件。

- [ ] **Step 3: 本地 UI 檢查**

`bun run dev`（root）+ `bun run dev`（frontend），以 Playwright 開啟群發頁：選 1 張 >1MB 的 PNG + 1 張 JPEG，確認縮圖、上傳狀態、前移/移除、送出按鈕停用條件、桌機與手機寬度版面。**不要按送出**（remote 綁定會真的發給客戶）。

- [ ] **Step 4: 【需使用者同意】部署**

詢問使用者後，依 `reference_production_deploy_guard` 設定 `MCIS_CONFIRM_PRODUCTION`，執行 `bun run deploy`（Worker）與 `bun run deploy:pages`（Frontend）。

- [ ] **Step 5: 【需使用者配合】真機驗收**

請使用者建立只含自己 LINE 帳號的測試標籤，群發「文字 + 4 張圖（含 1 張 >1MB 原圖）」。驗收：
- LINE 端依序收到文字、圖1–圖4，縮圖正常（非破圖），點開為原圖。
- 客服對話紀錄出現一則含文字與 4 張圖的訊息。
- 群發歷史顯示「圖文」，詳情顯示 4 張縮圖。

- [ ] **Step 6: 推送與 PR**

```bash
git push -u origin feat/broadcast-images
gh pr create --title "feat(broadcast): text + up to 4 images" --body "Implements docs/superpowers/specs/2026-10-06-broadcast-images-design.md"
```

- [ ] **Step 7: 追蹤 issue**

單發 >1MB 破圖已開 issue #61（2026-10-06）。在 PR 描述中連結 #61，並說明 `broadcast-image-preview.ts` 可供其修正重用。
