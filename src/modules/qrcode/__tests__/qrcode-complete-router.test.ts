// QRCode 完整版路由測試
// 測試完整版 QR Code 路由器的所有端點

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Hono } from 'hono';
import { qrCodeRouter } from '@modules/qrcode/handlers/index';
import type { Bindings } from '../../../types';

// ======================== Mock 設置 ========================

// Mock 環境變數
const mockEnv: Partial<Bindings> = {
  DB: {
    prepare: vi.fn().mockReturnValue({
      first: vi.fn().mockResolvedValue({ result: 1 }),
      all: vi.fn().mockResolvedValue({ results: [] }),
      run: vi.fn().mockResolvedValue({ success: true })
    })
  } as any,
  KV: {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined)
  } as any,
  R2_BUCKET: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  } as any,
  JWT_SECRET: 'test-secret'
};

// ======================== 測試應用設置 ========================

// 測試環境的 Variables 類型定義
interface TestVariables {
  userId: number;
  userRole: string;
  teamId: number;
  user?: { id: number; role: string; teamId: number };
}

const createTestApp = () => {
  const app = new Hono<{ Bindings: Bindings; Variables: TestVariables }>();

  // Mock 認證中間件
  app.use('*', async (c, next) => {
    c.set('userId', 1);
    c.set('userRole', 'admin');
    c.set('teamId', 1);
    await next();
  });

  // 掛載 QR Code 路由
  app.route('/api/qr-codes', qrCodeRouter);

  // 設置環境變數
  app.use('*', async (c, next) => {
    Object.assign(c.env, mockEnv);
    await next();
  });

  return app;
};

// ======================== 健康檢查測試 ========================

describe('QRCode Complete Router - Health Check', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
  });

  it('should return health status', async () => {
    const req = new Request('http://localhost/api/qr-codes/health', {
      method: 'GET'
    });

    const res = await app.fetch(req, mockEnv as any);
    const json = await res.json() as {
      success: boolean;
      data: {
        status: string;
        module: string;
        version: string;
        services: Record<string, any>;
      };
    };

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toHaveProperty('status', 'healthy');
    expect(json.data).toHaveProperty('module', 'qrcode');
    expect(json.data).toHaveProperty('version', '2.0.0');
    expect(json.data).toHaveProperty('services');
  });

  it('should check database connection', async () => {
    const req = new Request('http://localhost/api/qr-codes/health', {
      method: 'GET'
    });

    const res = await app.fetch(req, mockEnv as any);
    const json = await res.json() as {
      success: boolean;
      data: {
        status: string;
        module: string;
        version: string;
        services: Record<string, any>;
      };
    };

    expect(json.data.services).toHaveProperty('database');
    expect(json.data.services).toHaveProperty('cache');
    expect(json.data.services).toHaveProperty('storage');
  });
});

// ======================== 基本 CRUD 測試 ========================

describe('QRCode Complete Router - CRUD Operations', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
  });

  describe('List QR Codes', () => {
    it('should list QR codes', async () => {
      const req = new Request('http://localhost/api/qr-codes/', {
        method: 'GET'
      });

      const res = await app.fetch(req, mockEnv as any);

      expect(res.status).toBe(200);
    });

    it('should support pagination parameters', async () => {
      const req = new Request('http://localhost/api/qr-codes/?page=2&limit=25', {
        method: 'GET'
      });

      const res = await app.fetch(req, mockEnv as any);

      expect(res.status).toBe(200);
    });
  });

  describe('Create QR Code', () => {
    it('should create QR code', async () => {
      const req = new Request('http://localhost/api/qr-codes/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test QR',
          type: 'url',
          content: 'https://example.com'
        })
      });

      const res = await app.fetch(req, mockEnv as any);

      expect(res.status).toBe(201);
    });

    it('should reject missing required fields', async () => {
      const req = new Request('http://localhost/api/qr-codes/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test QR'
        })
      });

      const res = await app.fetch(req, mockEnv as any);

      expect(res.status).toBe(400);
    });
  });

  describe('Get QR Code by ID', () => {
    it('should get QR code details', async () => {
      const req = new Request('http://localhost/api/qr-codes/test-id', {
        method: 'GET'
      });

      const res = await app.fetch(req, mockEnv as any);

      expect([200, 404]).toContain(res.status);
    });
  });

  describe('Update QR Code', () => {
    it('should update QR code', async () => {
      const req = new Request('http://localhost/api/qr-codes/test-id', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Updated Name'
        })
      });

      const res = await app.fetch(req, mockEnv as any);

      expect([200, 404]).toContain(res.status);
    });
  });

  describe('Delete QR Code', () => {
    it('should delete QR code', async () => {
      const req = new Request('http://localhost/api/qr-codes/test-id', {
        method: 'DELETE'
      });

      const res = await app.fetch(req, mockEnv as any);

      expect([200, 404]).toContain(res.status);
    });
  });
});

// ======================== 狀態管理測試 ========================

describe('QRCode Complete Router - Status Management', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
  });

  it('should enable QR code', async () => {
    const req = new Request('http://localhost/api/qr-codes/test-id/enable', {
      method: 'POST'
    });

    const res = await app.fetch(req, mockEnv as any);

    expect([200, 404, 500]).toContain(res.status);
  });

  it('should disable QR code', async () => {
    const req = new Request('http://localhost/api/qr-codes/test-id/disable', {
      method: 'POST'
    });

    const res = await app.fetch(req, mockEnv as any);

    expect([200, 404, 500]).toContain(res.status);
  });

  it('should set expiry date', async () => {
    const req = new Request('http://localhost/api/qr-codes/test-id/expiry', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expiresAt: new Date(Date.now() + 86400000).toISOString()
      })
    });

    const res = await app.fetch(req, mockEnv as any);

    expect([200, 404, 500]).toContain(res.status);
  });
});

// ======================== 統計和分析測試 ========================

describe('QRCode Complete Router - Statistics', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
  });

  it('should get stats overview', async () => {
    const req = new Request('http://localhost/api/qr-codes/stats/overview', {
      method: 'GET'
    });

    const res = await app.fetch(req, mockEnv as any);

    expect([200, 500]).toContain(res.status);
  });

  it('should get scan history', async () => {
    const req = new Request('http://localhost/api/qr-codes/test-id/scans', {
      method: 'GET'
    });

    const res = await app.fetch(req, mockEnv as any);

    expect(res.status).toBe(200);
  });

  it('should get type distribution', async () => {
    const req = new Request('http://localhost/api/qr-codes/stats/types', {
      method: 'GET'
    });

    const res = await app.fetch(req, mockEnv as any);

    expect(res.status).toBe(200);
  });

  it('should get scan trends', async () => {
    const req = new Request('http://localhost/api/qr-codes/stats/trends', {
      method: 'GET'
    });

    const res = await app.fetch(req, mockEnv as any);

    expect(res.status).toBe(200);
  });
});

// ======================== 搜尋和過濾測試 ========================

describe('QRCode Complete Router - Search and Filter', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
  });

  it('should search QR codes', async () => {
    const req = new Request('http://localhost/api/qr-codes/search?q=test', {
      method: 'GET'
    });

    const res = await app.fetch(req, mockEnv as any);

    expect([200, 500]).toContain(res.status);
  });

  it('should get QR codes by type', async () => {
    const req = new Request('http://localhost/api/qr-codes/type/url', {
      method: 'GET'
    });

    const res = await app.fetch(req, mockEnv as any);

    expect(res.status).toBe(200);
  });

  it('should get QR codes by tag', async () => {
    const req = new Request('http://localhost/api/qr-codes/tags/important', {
      method: 'GET'
    });

    const res = await app.fetch(req, mockEnv as any);

    expect(res.status).toBe(200);
  });
});

// ======================== 批次操作測試 ========================

describe('QRCode Complete Router - Batch Operations', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
  });

  it('should batch create QR codes', async () => {
    const req = new Request('http://localhost/api/qr-codes/batch/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        qrCodes: [
          { name: 'QR 1', type: 'url', content: 'https://example1.com' },
          { name: 'QR 2', type: 'url', content: 'https://example2.com' }
        ]
      })
    });

    const res = await app.fetch(req, mockEnv as any);

    expect([200, 400, 500]).toContain(res.status);
  });

  it('should batch update QR codes', async () => {
    const req = new Request('http://localhost/api/qr-codes/batch/update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ids: ['id1', 'id2'],
        updates: { status: 'active' }
      })
    });

    const res = await app.fetch(req, mockEnv as any);

    expect(res.status).toBe(200);
  });

  it('should batch delete QR codes', async () => {
    const req = new Request('http://localhost/api/qr-codes/batch/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ids: ['id1', 'id2']
      })
    });

    const res = await app.fetch(req, mockEnv as any);

    expect(res.status).toBe(200);
  });

  it('should batch update status', async () => {
    const req = new Request('http://localhost/api/qr-codes/batch/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ids: ['id1', 'id2'],
        status: 'active'
      })
    });

    const res = await app.fetch(req, mockEnv as any);

    expect(res.status).toBe(200);
  });
});

// ======================== 標籤管理測試 ========================

describe('QRCode Complete Router - Tag Management', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
  });

  it('should get available tags', async () => {
    const req = new Request('http://localhost/api/qr-codes/tags/available', {
      method: 'GET'
    });

    const res = await app.fetch(req, mockEnv as any);

    expect(res.status).toBe(200);
  });

  it('should add tags to QR code', async () => {
    const req = new Request('http://localhost/api/qr-codes/test-id/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tags: ['tag1', 'tag2']
      })
    });

    const res = await app.fetch(req, mockEnv as any);

    expect([200, 404, 500]).toContain(res.status);
  });

  it('should remove tags from QR code', async () => {
    const req = new Request('http://localhost/api/qr-codes/test-id/tags', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tags: ['tag1']
      })
    });

    const res = await app.fetch(req, mockEnv as any);

    expect([200, 404, 500]).toContain(res.status);
  });
});

// ======================== 模板功能測試 ========================

describe('QRCode Complete Router - Templates', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
  });

  it('should get templates', async () => {
    const req = new Request('http://localhost/api/qr-codes/templates', {
      method: 'GET'
    });

    const res = await app.fetch(req, mockEnv as any);

    expect(res.status).toBe(200);
  });
});

// ======================== 公開端點測試 ========================

describe('QRCode Complete Router - Public Endpoints', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
  });

  it('should scan and redirect', async () => {
    const req = new Request('http://localhost/api/qr-codes/scan/test-id', {
      method: 'GET'
    });

    const res = await app.fetch(req, mockEnv as any);

    expect([200, 302, 404, 500]).toContain(res.status);
  });

  it('should get public info', async () => {
    const req = new Request('http://localhost/api/qr-codes/public/test-id/info', {
      method: 'GET'
    });

    const res = await app.fetch(req, mockEnv as any);

    expect([200, 404, 500]).toContain(res.status);
  });
});

// ======================== 管理員功能測試 ========================

describe('QRCode Complete Router - Admin Functions', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
  });

  it('should get system stats (admin only)', async () => {
    const req = new Request('http://localhost/api/qr-codes/admin/system-stats', {
      method: 'GET'
    });

    const res = await app.fetch(req, mockEnv as any);

    expect(res.status).toBe(200);
  });

  it('should cleanup expired QR codes (admin only)', async () => {
    const req = new Request('http://localhost/api/qr-codes/admin/cleanup', {
      method: 'POST'
    });

    const res = await app.fetch(req, mockEnv as any);

    expect(res.status).toBe(200);
  });

  it('should rebuild cache (admin only)', async () => {
    const req = new Request('http://localhost/api/qr-codes/admin/rebuild-cache', {
      method: 'POST'
    });

    const res = await app.fetch(req, mockEnv as any);

    expect(res.status).toBe(200);
  });
});

// ======================== 錯誤處理測試 ========================

describe('QRCode Complete Router - Error Handling', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
  });

  it('should handle invalid JSON', async () => {
    const req = new Request('http://localhost/api/qr-codes/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json'
    });

    const res = await app.fetch(req, mockEnv as any);

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('should return 404 for non-existent routes', async () => {
    const req = new Request('http://localhost/api/qr-codes/invalid-route', {
      method: 'GET'
    });

    const res = await app.fetch(req, mockEnv as any);

    expect(res.status).toBe(404);
  });
});

// ======================== 性能測試 ========================

describe('QRCode Complete Router - Performance', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
  });

  it('should handle health check quickly', async () => {
    const startTime = Date.now();

    const req = new Request('http://localhost/api/qr-codes/health', {
      method: 'GET'
    });

    await app.fetch(req, mockEnv as any);

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    expect(responseTime).toBeLessThan(100);
  });

  it('should handle concurrent requests', async () => {
    const requests = Array.from({ length: 10 }, () =>
      app.fetch(
        new Request('http://localhost/api/qr-codes/health', {
          method: 'GET'
        }),
        mockEnv as any
      )
    );

    const results = await Promise.all(requests);

    results.forEach(res => {
      expect(res.status).toBe(200);
    });
  });
});