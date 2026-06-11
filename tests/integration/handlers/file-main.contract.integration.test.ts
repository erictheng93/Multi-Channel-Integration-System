import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Hono } from 'hono';

const mockUploadFile = vi.fn();
const mockDownloadFile = vi.fn();
const mockGetFileStatistics = vi.fn();
const mockGetFileDetails = vi.fn();

vi.mock('@/middleware/auth', () => ({
  jwtAuth: vi.fn(async (c: any, next: any) => {
    c.set('jwtPayload', { userId: 'agent-1', role: 'agent' });
    c.set('user', { id: 'agent-1', role: 'agent' });
    await next();
  })
}));

vi.mock('@modules/file-management/services/file-service', () => ({
  FileService: vi.fn().mockImplementation(function () {
    return {
      uploadFile: mockUploadFile,
      downloadFile: mockDownloadFile,
      getFileStatistics: mockGetFileStatistics,
      getFileDetails: mockGetFileDetails
    };
  })
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

import fileMainHandler from '@/modules/file-management/handlers/file-main';
import type { Bindings } from '@/types';

function createTestApp() {
  const app = new Hono<{ Bindings: Bindings }>();
  app.use('*', async (c, next) => {
    c.env = {
      DB: {},
      CACHE: {},
      R2_BUCKET: {}
    } as Bindings;
    await next();
  });
  app.route('/api/files', fileMainHandler);
  return app;
}

describe('file-main shared contract routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('accepts file upload at the fileContracts.uploadFile path', async () => {
    mockUploadFile.mockResolvedValueOnce({
      success: true,
      file: {
        id: 'file-1',
        filename: 'hello.txt',
        size: 5,
        mimeType: 'text/plain',
        url: '/files/hello.txt',
        publicUrl: '/public/hello.txt',
        type: 'document',
        createdAt: '2026-01-15T12:00:00Z'
      }
    });

    const formData = new FormData();
    formData.append('file', new File(['hello'], 'hello.txt', { type: 'text/plain' }));
    formData.append('platform', 'system');

    const res = await createTestApp().request('/api/files/upload', {
      method: 'POST',
      body: formData
    });
    const body = (await res.json()) as any;

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.fileId).toBe('file-1');
    expect(mockUploadFile).toHaveBeenCalledWith(expect.objectContaining({
      filename: 'hello.txt',
      mimeType: 'text/plain',
      platform: 'system',
      uploadedBy: 'agent-1'
    }));
  });

  test('accepts multiple file upload at the fileContracts.uploadMultipleFiles path', async () => {
    mockUploadFile
      .mockResolvedValueOnce({
        success: true,
        file: {
          id: 'file-1',
          filename: 'one.txt',
          size: 3,
          mimeType: 'text/plain',
          url: '/files/one.txt',
          platform: 'system'
        }
      })
      .mockResolvedValueOnce({
        success: true,
        file: {
          id: 'file-2',
          filename: 'two.txt',
          size: 3,
          mimeType: 'text/plain',
          url: '/files/two.txt',
          platform: 'system'
        }
      });

    const formData = new FormData();
    formData.append('files', new File(['one'], 'one.txt', { type: 'text/plain' }));
    formData.append('files', new File(['two'], 'two.txt', { type: 'text/plain' }));

    const res = await createTestApp().request('/api/files/upload-multiple', {
      method: 'POST',
      body: formData
    });
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].fileId).toBe('file-1');
    expect(mockUploadFile).toHaveBeenCalledTimes(2);
  });

  test('returns file statistics at the fileContracts.stats path', async () => {
    mockGetFileStatistics.mockResolvedValueOnce({
      totalFiles: 2,
      totalSize: 1024,
      averageFileSize: 512,
      filesByType: { image: 1, document: 1 },
      filesByPlatform: { system: 2 },
      storageUsage: { used: 1024, available: 2048, percentage: 50 },
      recentActivity: { uploaded: 2, downloaded: 0, deleted: 0, period: '7d' }
    });

    const res = await createTestApp().request('/api/files/stats?period=7d');
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.totalFiles).toBe(2);
    expect(mockGetFileStatistics).toHaveBeenCalledWith('7d', {
      uploadedBy: 'agent-1'
    });
  });

  test('searches files at the fileContracts.search path', async () => {
    const item = {
      id: 'file-1',
      filename: 'invoice.pdf',
      mimeType: 'application/pdf',
      size: 100,
      extension: 'pdf',
      url: '/files/invoice.pdf',
      platform: 'system',
      metadata: {
        filename: 'invoice.pdf',
        mimeType: 'application/pdf',
        size: 100,
        extension: 'pdf'
      },
      processingStatus: 'completed',
      createdAt: '2026-01-15T12:00:00Z',
      updatedAt: '2026-01-15T12:00:00Z'
    };
    const listFiles = vi.fn().mockResolvedValueOnce({
      items: [item],
      total: 1,
      page: 3,
      pageSize: 10
    });
    const { FileService } = await import('@modules/file-management/services/file-service');
    vi.mocked(FileService).mockImplementationOnce(function () {
      return {
        uploadFile: mockUploadFile,
        downloadFile: mockDownloadFile,
        getFileStatistics: mockGetFileStatistics,
        getFileDetails: mockGetFileDetails,
        listFiles
      } as any;
    });

    const res = await createTestApp().request(
      '/api/files/search?q=invoice&page=3&pageSize=10&platform=system&type=document'
    );
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].filename).toBe('invoice.pdf');
    expect(listFiles).toHaveBeenCalledWith(expect.objectContaining({
      page: 3,
      pageSize: 10,
      platform: 'system',
      type: 'document'
    }));
  });

  test('returns a download URL at the fileContracts.getDownloadUrl path', async () => {
    mockDownloadFile.mockResolvedValueOnce({
      success: true,
      url: '/api/files/file-1?sig=test'
    });

    const res = await createTestApp().request('/api/files/file-1/download-url?expiresIn=600');
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.url).toBe('/api/files/file-1?sig=test');
    expect(body.data.expiresAt).toBeDefined();
    expect(mockDownloadFile).toHaveBeenCalledWith('file-1', {
      includeMetadata: true,
      responseType: 'url',
      generateDownloadUrl: true,
      urlExpiresIn: 600
    });
  });

  test('returns file metadata at the fileContracts.getDetails path', async () => {
    mockGetFileDetails.mockResolvedValueOnce({
      id: 'file-1',
      filename: 'hello.txt',
      mimeType: 'text/plain',
      size: 5,
      extension: 'txt',
      url: '/files/hello.txt',
      platform: 'system',
      metadata: {
        filename: 'hello.txt',
        mimeType: 'text/plain',
        size: 5,
        extension: 'txt'
      },
      processingStatus: 'completed',
      createdAt: '2026-01-15T12:00:00Z',
      updatedAt: '2026-01-15T12:00:00Z'
    });

    const res = await createTestApp().request('/api/files/file-1');
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('file-1');
    expect(body.data.filename).toBe('hello.txt');
    expect(mockGetFileDetails).toHaveBeenCalledWith('file-1');
    expect(mockDownloadFile).not.toHaveBeenCalled();
  });

  test('streams file data when responseType=stream is requested', async () => {
    mockDownloadFile.mockResolvedValueOnce({
      success: true,
      data: new TextEncoder().encode('hello').buffer,
      contentType: 'text/plain',
      contentLength: 5,
      metadata: {
        filename: 'hello.txt'
      }
    });

    const res = await createTestApp().request('/api/files/file-1?responseType=stream');

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/plain');
    expect(res.headers.get('Content-Length')).toBe('5');
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="hello.txt"');
    expect(await res.text()).toBe('hello');
    expect(mockDownloadFile).toHaveBeenCalledWith('file-1', {
      includeMetadata: true,
      responseType: 'stream',
      generateDownloadUrl: false,
      urlExpiresIn: 3600
    });
    expect(mockGetFileDetails).not.toHaveBeenCalled();
  });

  test('deletes multiple files at the fileContracts.deleteMultiple path', async () => {
    const mockDeleteFile = vi.fn()
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, error: 'not found' });
    const { FileService } = await import('@modules/file-management/services/file-service');
    vi.mocked(FileService).mockImplementationOnce(function () {
      return {
        uploadFile: mockUploadFile,
        downloadFile: mockDownloadFile,
        getFileStatistics: mockGetFileStatistics,
        getFileDetails: mockGetFileDetails,
        deleteFile: mockDeleteFile
      } as any;
    });

    const res = await createTestApp().request('/api/files/delete-multiple', {
      method: 'POST',
      body: JSON.stringify({ fileIds: ['file-1', 'missing'] }),
      headers: { 'Content-Type': 'application/json' }
    });
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({
      successful: ['file-1'],
      failed: ['missing']
    });
    expect(mockDeleteFile).toHaveBeenNthCalledWith(1, 'file-1', 'agent-1');
    expect(mockDeleteFile).toHaveBeenNthCalledWith(2, 'missing', 'agent-1');
  });
});
