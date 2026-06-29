import { beforeEach, describe, expect, it, vi } from 'vitest';

const whereCalls: unknown[] = [];
let selectRows: unknown[] = [];
let selectGetResult: unknown;
let signedUrlCalls: Array<[string, string, number | undefined]> = [];

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((left, right) => ({ op: 'eq', left, right })),
  and: vi.fn((...conditions) => ({ op: 'and', conditions })),
  desc: vi.fn((column) => ({ op: 'desc', column })),
  gte: vi.fn((left, right) => ({ op: 'gte', left, right })),
  like: vi.fn((left, right) => ({ op: 'like', left, right })),
  lte: vi.fn((left, right) => ({ op: 'lte', left, right })),
  sql: vi.fn(() => ({ as: vi.fn((name: string) => ({ op: 'sql', name })) }))
}));

function createSelectChain() {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn((condition?: unknown) => {
      whereCalls.push(condition);
      return chain;
    }),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    offset: vi.fn(async () => selectRows),
    get: vi.fn(async () => selectGetResult),
    all: vi.fn(async () => selectRows)
  };
  return chain;
}

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => ({
    select: vi.fn(() => createSelectChain())
  }))
}));

vi.mock('@modules/file-management/services/storage-service', () => ({
  createStorageService: vi.fn(() => ({
    generateSignedUrl: vi.fn((key: string, action: string, expiresIn?: number) => {
      signedUrlCalls.push([key, action, expiresIn]);
      return Promise.resolve(`signed:${key}`);
    }),
    downloadFile: vi.fn(),
    deleteFile: vi.fn(),
    uploadFile: vi.fn()
  }))
}));

vi.mock('@modules/file-management/services/validation-service', () => ({
  FileValidationService: vi.fn()
}));

vi.mock('@modules/file-management/services/metadata-service', () => ({
  MetadataService: vi.fn()
}));

vi.mock('@/utils/logger', () => ({
  createContextLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }))
}));

vi.mock('@/utils/timestamp', () => ({
  nowISO: vi.fn(() => '2026-01-15T12:00:00Z'),
  nowMs: vi.fn(() => 1768483200000)
}));

import { eq } from 'drizzle-orm';
import { fileAttachments } from '@/db/schema';
import { FileService } from '@modules/file-management/services/file-service';
import type { Bindings } from '@/types';

function createService() {
  return new FileService({ DB: {}, R2_BUCKET: {} } as Bindings);
}

describe('FileService authorization filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    whereCalls.length = 0;
    selectRows = [];
    selectGetResult = { count: 0 };
    signedUrlCalls = [];
  });

  it('filters file listing by uploader when uploadedBy is provided', async () => {
    await createService().listFiles({ uploadedBy: 'agent-1' });

    expect(eq).toHaveBeenCalledWith(fileAttachments.uploadedBy, 'agent-1');
    expect(whereCalls[0]).toEqual({
      op: 'and',
      conditions: [{ op: 'eq', left: fileAttachments.uploadedBy, right: 'agent-1' }]
    });
    expect(whereCalls[1]).toEqual(whereCalls[0]);
  });

  it('filters signed URL downloads by file id and uploader', async () => {
    selectGetResult = {
      id: 'file-1',
      filename: 'invoice.pdf',
      mimeType: 'application/pdf',
      fileSize: 100,
      fileUrl: '/files/invoice.pdf',
      r2Key: 'uploads/invoice.pdf',
      uploadedBy: 'agent-1'
    };

    const result = await createService().downloadFile('file-1', {
      responseType: 'url',
      generateDownloadUrl: true,
      urlExpiresIn: 600,
      uploadedBy: 'agent-1'
    });

    expect(result.success).toBe(true);
    expect(result.url).toBe('signed:uploads/invoice.pdf');
    expect(eq).toHaveBeenCalledWith(fileAttachments.id, 'file-1');
    expect(eq).toHaveBeenCalledWith(fileAttachments.uploadedBy, 'agent-1');
    expect(whereCalls[0]).toEqual({
      op: 'and',
      conditions: [
        { op: 'eq', left: fileAttachments.id, right: 'file-1' },
        { op: 'eq', left: fileAttachments.uploadedBy, right: 'agent-1' }
      ]
    });
    expect(signedUrlCalls).toEqual([['uploads/invoice.pdf', 'read', 600]]);
  });

  it('filters file metadata lookups by file id and uploader', async () => {
    selectGetResult = {
      id: 'file-1',
      filename: 'invoice.pdf',
      mimeType: 'application/pdf',
      fileSize: 100,
      fileUrl: '/files/invoice.pdf',
      r2Key: 'uploads/invoice.pdf',
      uploadedBy: 'agent-1'
    };

    const result = await createService().getFileDetails('file-1', { uploadedBy: 'agent-1' });

    expect(result?.id).toBe('file-1');
    expect(eq).toHaveBeenCalledWith(fileAttachments.id, 'file-1');
    expect(eq).toHaveBeenCalledWith(fileAttachments.uploadedBy, 'agent-1');
    expect(whereCalls[0]).toEqual({
      op: 'and',
      conditions: [
        { op: 'eq', left: fileAttachments.id, right: 'file-1' },
        { op: 'eq', left: fileAttachments.uploadedBy, right: 'agent-1' }
      ]
    });
  });
});
