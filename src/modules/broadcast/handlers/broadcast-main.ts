import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Bindings, DbUser } from '@/types';
import { createDbClient } from '@/db/drizzle-factory';
import { jwtAuth } from '@/middleware/auth';
import { errorResponse, forbiddenResponse, successResponse, validationErrorResponse } from '@/utils/api-response';
import { BroadcastService } from '@modules/broadcast/services/broadcast-service';
import { BroadcastSenderService } from '@modules/broadcast/services/broadcast-sender-service';
import {
  BroadcastServiceError,
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

  const service = new BroadcastService(createDbClient(c.env.DB));
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

  const service = new BroadcastService(createDbClient(c.env.DB));
  try {
    const broadcast = await service.create(parsed.input, String(user.id));
    return successResponse(c, broadcast, 'Broadcast created', 201);
  } catch (error) {
    return handleBroadcastError(c, error);
  }
});

broadcastRouter.get('/', async (c) => {
  const permission = requireBroadcastPermission(c.get('user'));
  if (!permission.allowed) {
    return forbiddenResponse(c, permission.message);
  }

  const service = new BroadcastService(createDbClient(c.env.DB));
  const page = parsePositiveInt(c.req.query('page'), 1);
  const pageSize = parsePositiveInt(c.req.query('pageSize') ?? c.req.query('limit'), 20);
  const result = await service.list(page, pageSize);
  return successResponse(c, result, 'Broadcasts retrieved');
});

broadcastRouter.get('/:id/recipients', async (c) => {
  const permission = requireBroadcastPermission(c.get('user'));
  if (!permission.allowed) {
    return forbiddenResponse(c, permission.message);
  }

  const status = parseRecipientStatus(c.req.query('status'));
  if (status.invalid) {
    return validationErrorResponse(c, [
      { field: 'status', message: 'status must be one of pending, sent, failed, skipped' },
    ]);
  }

  const service = new BroadcastService(createDbClient(c.env.DB));
  const broadcast = await service.getById(c.req.param('id'));
  if (!broadcast) {
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

  const sender = new BroadcastSenderService(createDbClient(c.env.DB), c.env);
  try {
    const stats = await sender.send(c.req.param('id'), user);
    return successResponse(c, stats, 'Broadcast sent');
  } catch (error) {
    return handleBroadcastError(c, error);
  }
});

broadcastRouter.get('/:id', async (c) => {
  const permission = requireBroadcastPermission(c.get('user'));
  if (!permission.allowed) {
    return forbiddenResponse(c, permission.message);
  }

  const service = new BroadcastService(createDbClient(c.env.DB));
  const broadcast = await service.getById(c.req.param('id'));
  if (!broadcast) {
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

  if (title.length < 1 || title.length > 100) {
    errors.push({ field: 'title', message: 'title must be 1-100 characters', value: record.title });
  }
  if (content.length < 1 || content.length > 2000) {
    errors.push({ field: 'content', message: 'content must be 1-2000 characters', value: record.content });
  }
  if (!parsedTagIds.ok) {
    errors.push({ field: 'tagIds', message: 'tagIds must be a non-empty array of positive integers' });
  }

  if (errors.length > 0 || !parsedTagIds.ok) {
    return { ok: false, errors };
  }

  return { ok: true, input: { title, content, tagIds: parsedTagIds.tagIds } };
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
      errors: [{ field: 'tagIds', message: 'tagIds must be a non-empty array of positive integers' }],
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
