import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Bindings, DbUser } from '@/types';
import { createDbClient } from '@/db/drizzle-factory';
import { jwtAuth } from '@/middleware/auth';
import { errorResponse, forbiddenResponse, successResponse, validationErrorResponse } from '@/utils/api-response';
import { BroadcastService } from '@modules/broadcast/services/broadcast-service';
import { BROADCAST_MAX_IMAGES } from '@modules/broadcast/services/broadcast-content';
import { BroadcastSenderService } from '@modules/broadcast/services/broadcast-sender-service';
import { LineQuotaMonitorService } from '@modules/broadcast/services/line-quota-monitor-service';
import {
  BroadcastServiceError,
  type BroadcastAttachmentInput,
  type BroadcastRecipientStatus,
  type CreateBroadcastInput,
} from '@modules/broadcast/types';

const broadcastRouter = new Hono<{ Bindings: Bindings }>();

broadcastRouter.use('/*', jwtAuth);

broadcastRouter.post('/preview', async (c) => {
  const permission = requireBroadcastPermission(c.get('user'));
  if (!permission.allowed) {
    return forbiddenResponse(c, permission.message);
  }

  const parsed = await parsePreviewInput(c.req.json());
  if (!parsed.ok) {
    return validationErrorResponse(c, parsed.errors);
  }

  if (parsed.tagIds.length !== 1) {
    return errorResponse(c, {
      code: 'PHASE1_SINGLE_TAG_ONLY',
      message: 'Phase 1 accepts exactly one tag',
    }, 422);
  }

  const service = new BroadcastService(createDbClient(c.env.DB), c.env);
  try {
    const preview = await service.preview(parsed.tagIds[0]);
    return successResponse(c, preview, 'Broadcast audience preview retrieved');
  } catch (error) {
    return handleBroadcastError(c, error);
  }
});

broadcastRouter.post('/', async (c) => {
  const user = c.get('user');
  const permission = requireBroadcastPermission(user);
  if (!permission.allowed) {
    return forbiddenResponse(c, permission.message);
  }

  const parsed = await parseCreateInput(c.req.json());
  if (!parsed.ok) {
    return validationErrorResponse(c, parsed.errors);
  }

  const service = new BroadcastService(createDbClient(c.env.DB), c.env);
  try {
    const broadcast = await service.create(parsed.input, String(user.id));
    return successResponse(c, broadcast, 'Broadcast created', 201);
  } catch (error) {
    return handleBroadcastError(c, error);
  }
});

broadcastRouter.get('/', async (c) => {
  const user = c.get('user');
  const permission = requireBroadcastPermission(user);
  if (!permission.allowed) {
    return forbiddenResponse(c, permission.message);
  }

  const service = new BroadcastService(createDbClient(c.env.DB), c.env);
  const page = parsePositiveInt(c.req.query('page'), 1);
  const pageSize = parsePositiveInt(c.req.query('pageSize') ?? c.req.query('limit'), 20);
  const result = await service.list(page, pageSize, broadcastOwnerScope(user));
  return successResponse(c, result, 'Broadcasts retrieved');
});

// Registered before '/:id' so 'line-quota' is not captured as a broadcast id.
broadcastRouter.get('/line-quota', async (c) => {
  const permission = requireBroadcastPermission(c.get('user'));
  if (!permission.allowed) {
    return forbiddenResponse(c, permission.message);
  }

  const service = new LineQuotaMonitorService(createDbClient(c.env.DB), c.env);
  return successResponse(c, await service.getSnapshot(), 'LINE quota snapshot retrieved');
});

broadcastRouter.post('/line-quota/refresh', async (c) => {
  const permission = requireBroadcastPermission(c.get('user'));
  if (!permission.allowed) {
    return forbiddenResponse(c, permission.message);
  }

  const service = new LineQuotaMonitorService(createDbClient(c.env.DB), c.env);
  return successResponse(c, await service.refresh('manual'), 'LINE quota refreshed');
});

broadcastRouter.get('/:id/recipients', async (c) => {
  const user = c.get('user');
  const permission = requireBroadcastPermission(user);
  if (!permission.allowed) {
    return forbiddenResponse(c, permission.message);
  }

  const status = parseRecipientStatus(c.req.query('status'));
  if (status.invalid) {
    return validationErrorResponse(c, [
      { field: 'status', message: '請選擇待發送、已發送、失敗或略過' },
    ]);
  }

  const service = new BroadcastService(createDbClient(c.env.DB), c.env);
  if (!await service.exists(c.req.param('id'), broadcastOwnerScope(user))) {
    return errorResponse(c, { code: 'NOT_FOUND', message: 'Broadcast not found' }, 404);
  }

  const page = parsePositiveInt(c.req.query('page'), 1);
  const pageSize = parsePositiveInt(c.req.query('pageSize') ?? c.req.query('limit'), 20);
  const result = await service.listRecipients(c.req.param('id'), page, pageSize, status.value);
  return successResponse(c, result, 'Broadcast recipients retrieved');
});

broadcastRouter.post('/:id/send', async (c) => {
  const user = c.get('user');
  const permission = requireBroadcastPermission(user);
  if (!permission.allowed) {
    return forbiddenResponse(c, permission.message);
  }

  const db = createDbClient(c.env.DB);
  if (!await new BroadcastService(db, c.env).exists(c.req.param('id'), broadcastOwnerScope(user))) {
    return errorResponse(c, { code: 'BROADCAST_NOT_FOUND', message: 'Broadcast not found' }, 404);
  }

  const sender = new BroadcastSenderService(db, c.env);
  try {
    const stats = await sender.send(c.req.param('id'), user);
    return successResponse(c, stats, 'Broadcast sent');
  } catch (error) {
    return handleBroadcastError(c, error);
  }
});

broadcastRouter.get('/:id', async (c) => {
  const user = c.get('user');
  const permission = requireBroadcastPermission(user);
  if (!permission.allowed) {
    return forbiddenResponse(c, permission.message);
  }

  const service = new BroadcastService(createDbClient(c.env.DB), c.env);
  const broadcast = await service.getById(c.req.param('id'));
  const owner = broadcastOwnerScope(user);
  if (!broadcast || (owner !== null && broadcast.createdBy !== owner)) {
    return errorResponse(c, { code: 'NOT_FOUND', message: 'Broadcast not found' }, 404);
  }
  return successResponse(c, broadcast, 'Broadcast retrieved');
});

function requireBroadcastPermission(user: DbUser): { allowed: true } | { allowed: false; message: string } {
  if (user.role === 'admin') {
    return { allowed: true };
  }

  const hasBroadcastRole = Object.values(user.teamRoles ?? {}).some(
    (role) => role === 'lead' || role === 'supervisor'
  );

  return hasBroadcastRole
    ? { allowed: true }
    : { allowed: false, message: 'Broadcast messaging requires admin, lead, or supervisor role' };
}

/** Non-admins only see and send their own broadcasts; null = everyone's (admin). */
function broadcastOwnerScope(user: DbUser): string | null {
  return user.role === 'admin' ? null : String(user.id);
}

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
    errors.push({ field: 'title', message: '請輸入 1 至 100 個字元', value: record.title });
  }
  if (content.length > 2000) {
    errors.push({ field: 'content', message: '最多 2000 個字元', value: record.content });
  }
  if (!parsedTagIds.ok) {
    errors.push({ field: 'tagIds', message: '請選擇有效的目標標籤' });
  }
  if (!parsedAttachments.ok) {
    errors.push({ field: 'attachments', message: '圖片與預覽圖資料不完整，請重新上傳' });
  } else if (parsedAttachments.attachments.length > BROADCAST_MAX_IMAGES) {
    errors.push({ field: 'attachments', message: `最多 ${BROADCAST_MAX_IMAGES} 張圖片` });
  } else if (content.length === 0 && parsedAttachments.attachments.length === 0) {
    errors.push({ field: 'content', message: '請輸入文字或加入至少一張圖片' });
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

async function parsePreviewInput(
  bodyPromise: Promise<unknown>
): Promise<
  | { ok: true; tagIds: number[] }
  | { ok: false; errors: Array<{ field: string; message: string; value?: unknown }> }
> {
  const body = await bodyPromise.catch(() => null);
  const record = isRecord(body) ? body : {};
  const parsedTagIds = parseTagIds(record);

  if (!parsedTagIds.ok) {
    return {
      ok: false,
      errors: [{ field: 'tagIds', message: '請選擇有效的目標標籤' }],
    };
  }

  return { ok: true, tagIds: parsedTagIds.tagIds };
}

function parseTagIds(
  record: Record<string, unknown>
): { ok: true; tagIds: number[] } | { ok: false } {
  const rawTagIds = Array.isArray(record.tagIds) ? record.tagIds : [];
  const tagIds = rawTagIds
    .map((value) => (typeof value === 'number' ? value : Number(value)))
    .filter((value) => Number.isInteger(value) && value > 0);

  return rawTagIds.length > 0 && tagIds.length === rawTagIds.length
    ? { ok: true, tagIds }
    : { ok: false };
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseRecipientStatus(
  value: string | undefined
): { invalid: false; value?: BroadcastRecipientStatus } | { invalid: true } {
  if (!value) {
    return { invalid: false };
  }

  if (value === 'pending' || value === 'sent' || value === 'failed' || value === 'skipped') {
    return { invalid: false, value };
  }

  return { invalid: true };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function handleBroadcastError(c: Parameters<typeof errorResponse>[0], error: unknown): Response {
  if (error instanceof BroadcastServiceError) {
    return errorResponse(c, { code: error.code, message: error.message }, error.status as ContentfulStatusCode);
  }

  throw error;
}

export default broadcastRouter;
