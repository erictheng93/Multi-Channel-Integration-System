import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDownloadFile = vi.fn();
const mockGetFileDetails = vi.fn();
const mockGetFileStatistics = vi.fn();
const mockListFiles = vi.fn();

vi.mock('@modules/file-management/services/file-service', () => ({
  FileService: vi.fn(function () {
    return {
      downloadFile: mockDownloadFile,
      getFileDetails: mockGetFileDetails,
      getFileStatistics: mockGetFileStatistics,
      listFiles: mockListFiles
    };
  })
}));

vi.mock('@/utils/timestamp', () => ({
  nowISO: vi.fn(() => '2026-01-15T12:00:00Z'),
  nowMs: vi.fn(() => 1768483200000)
}));

import { FileHandler } from '@modules/file-management/handlers/file-handler';
import type { Bindings } from '@/types';

function createContext(path = '/files', role: 'admin' | 'agent' = 'agent') {
  const url = new URL(path, 'http://localhost');
  return {
    env: { DB: {}, CACHE: {}, R2_BUCKET: {} } as Bindings,
    req: {
      param: vi.fn((name: string) => {
        if (name === 'fileId') return 'file-1';
        if (name === 'conversationId') return 'conversation-1';
        if (name === 'messageId') return 'message-1';
        return undefined;
      }),
      query: vi.fn((name: string) => url.searchParams.get(name) ?? undefined),
      json: vi.fn()
    },
    get: vi.fn((key: string) => {
      if (key === 'jwtPayload') {
        return { userId: 'agent-1', role };
      }
      return undefined;
    }),
    json: vi.fn((data: unknown, status = 200) => {
      return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
      });
    })
  };
}

function createHandler() {
  return new FileHandler({ DB: {}, CACHE: {}, R2_BUCKET: {} } as Bindings);
}

describe('FileHandler authorization filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDownloadFile.mockResolvedValue({
      success: true,
      url: '/files/file-1',
      data: new Uint8Array([1]).buffer,
      contentType: 'text/plain',
      contentLength: 1,
      metadata: { filename: 'file.txt' }
    });
    mockGetFileDetails.mockResolvedValue({ id: 'file-1' });
    mockGetFileStatistics.mockResolvedValue({ totalFiles: 0 });
    mockListFiles.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
  });

  it('forces list filters to the authenticated non-admin user', async () => {
    await createHandler().list(createContext('/files?uploadedBy=other-user') as any);

    expect(mockListFiles).toHaveBeenCalledWith(expect.objectContaining({
      uploadedBy: 'agent-1'
    }));
  });

  it('passes owner scope to details and download operations', async () => {
    const handler = createHandler();

    await handler.getDetails(createContext('/files/file-1') as any);
    await handler.getDownloadUrl(createContext('/files/file-1/download-url?expiresIn=600') as any);
    await handler.download(createContext('/files/file-1/download') as any);

    expect(mockGetFileDetails).toHaveBeenCalledWith('file-1', { uploadedBy: 'agent-1' });
    expect(mockDownloadFile).toHaveBeenNthCalledWith(1, 'file-1', {
      responseType: 'url',
      generateDownloadUrl: true,
      urlExpiresIn: 600,
      uploadedBy: 'agent-1'
    });
    expect(mockDownloadFile).toHaveBeenNthCalledWith(2, 'file-1', {
      responseType: 'buffer',
      includeMetadata: true,
      uploadedBy: 'agent-1'
    });
  });

  it('leaves admin list uploader filters explicit instead of forcing their own id', async () => {
    await createHandler().list(createContext('/files?uploadedBy=agent-2', 'admin') as any);

    expect(mockListFiles).toHaveBeenCalledWith(expect.objectContaining({
      uploadedBy: 'agent-2'
    }));
  });
});
