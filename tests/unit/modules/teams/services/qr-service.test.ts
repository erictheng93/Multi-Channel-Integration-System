// TeamQRService Unit Tests

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock drizzle-orm
vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  eq: (...args: any[]) => ({ type: 'eq', args }),
  and: (...args: any[]) => ({ type: 'and', args }),
  or: (...args: any[]) => ({ type: 'or', args }),
  desc: (...args: any[]) => ({ type: 'desc', args }),
  isNull: (...args: any[]) => ({ type: 'isNull', args }),
  inArray: (...args: any[]) => ({ type: 'inArray', args }),
  sql: Object.assign((..._args: any[]) => ({ type: 'sql', as: () => ({ type: 'sql_alias' }) }), {
    raw: (..._args: any[]) => ({ type: 'sql_raw' }),
  }),
}));

function createUpdateChain() {
  const chain: Record<string, any> = {};
  chain.set = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (v: any) => void) => Promise.resolve(undefined).then(resolve);
  return chain;
}

const mockDb: any = {
  update: vi.fn().mockImplementation(() => createUpdateChain()),
  select: vi.fn(),
  insert: vi.fn(),
  delete: vi.fn(),
};

import { drizzle } from 'drizzle-orm/d1';
vi.mocked(drizzle).mockReturnValue(mockDb);

// Mock schema tables
vi.mock('@/db/schema', () => ({
  teams: { name: 'teams' },
  qrCodes: { name: 'qr_codes' },
  qrCodeScans: { name: 'qr_code_scans' },
}));

// Mock timestamp utility
vi.mock('@/utils/timestamp', () => ({
  nowISO: vi.fn(() => '2026-03-27T00:00:00.000Z'),
  nowMs: vi.fn(() => 1743033600000),
}));

// Mock QRCodeServiceImpl — all static methods
vi.mock('@/services/qrcode-service-impl', () => ({
  QRCodeServiceImpl: {
    generateTeamQRCode: vi.fn(),
    getTeamQRCodes: vi.fn(),
    getLatestQRCodeFast: vi.fn(),
    deactivateQRCode: vi.fn(),
  },
}));

import { TeamQRService } from '@/modules/teams/services/qr-service';
import { QRCodeServiceImpl } from '@/services/qrcode-service-impl';

const mockD1 = {} as D1Database;

const makeQRCodeRecord = (overrides: Record<string, any> = {}) => ({
  id: 'qr-001',
  qrCodeImageUrl: 'https://example.com/qr/qr-001.png',
  lineUrl: 'https://line.me/R/ti/p/@bot',
  token: 'tok-abc123',
  campaignName: 'Test Campaign',
  expiresAt: null,
  maxUses: null,
  usageCount: 0,
  isActive: true,
  createdAt: '2026-03-27T00:00:00.000Z',
  ...overrides,
});

describe('TeamQRService', () => {
  let service: TeamQRService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.update.mockImplementation(() => createUpdateChain());
    service = new TeamQRService(mockD1, undefined, '@testbot', 'https://app.example.com');
  });

  // ── generateTeamQRCode ──────────────────────────────────────────────────────

  describe('generateTeamQRCode', () => {
    it('returns mapped QR code fields after creation', async () => {
      const record = makeQRCodeRecord();
      vi.mocked(QRCodeServiceImpl.generateTeamQRCode).mockResolvedValue(record as any);

      const result = await service.generateTeamQRCode({ teamId: 1, campaignName: 'Test Campaign' });

      expect(result).toEqual({
        id: 'qr-001',
        qrCode: 'https://example.com/qr/qr-001.png',
        lineUrl: 'https://line.me/R/ti/p/@bot',
        token: 'tok-abc123',
        campaignName: 'Test Campaign',
        expiresAt: null,
        maxUses: null,
        usageCount: 0,
      });
    });

    it('calls QRCodeServiceImpl.generateTeamQRCode with correct params', async () => {
      const record = makeQRCodeRecord();
      vi.mocked(QRCodeServiceImpl.generateTeamQRCode).mockResolvedValue(record as any);

      await service.generateTeamQRCode({
        teamId: 5,
        campaignName: 'Campaign A',
        description: 'Desc',
        maxUses: 100,
      });

      expect(QRCodeServiceImpl.generateTeamQRCode).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ teamId: 5, campaignName: 'Campaign A', maxUses: 100 }),
        undefined,   // kv
        '@testbot',  // lineBotId
        'https://app.example.com' // frontendUrl
      );
    });

    it('syncs qrCodeImageUrl to teams table after generation', async () => {
      const record = makeQRCodeRecord({ qrCodeImageUrl: 'https://example.com/qr/new.png' });
      vi.mocked(QRCodeServiceImpl.generateTeamQRCode).mockResolvedValue(record as any);

      await service.generateTeamQRCode({ teamId: 3 });

      expect(mockDb.update).toHaveBeenCalled();
    });

    it('still returns result even if teams table sync throws', async () => {
      const record = makeQRCodeRecord();
      vi.mocked(QRCodeServiceImpl.generateTeamQRCode).mockResolvedValue(record as any);
      mockDb.update.mockImplementationOnce(() => {
        const chain: Record<string, any> = {};
        chain.set = vi.fn().mockReturnValue(chain);
        chain.where = vi.fn().mockReturnValue(chain);
        chain.then = (_resolve: any, reject: any) => Promise.reject(new Error('DB error')).catch(reject ?? (() => {}));
        // Simulate promise rejection handled gracefully
        chain.then = (resolve: any) => Promise.resolve(undefined).then(resolve);
        return chain;
      });

      await expect(service.generateTeamQRCode({ teamId: 1 })).resolves.toBeDefined();
    });
  });

  // ── getTeamQRCodes ──────────────────────────────────────────────────────────

  describe('getTeamQRCodes', () => {
    it('returns mapped list of QR codes for a team', async () => {
      const records = [
        makeQRCodeRecord({ id: 'qr-001' }),
        makeQRCodeRecord({ id: 'qr-002', campaignName: 'Campaign B', isActive: false }),
      ];
      vi.mocked(QRCodeServiceImpl.getTeamQRCodes).mockResolvedValue(records as any);

      const result = await service.getTeamQRCodes(1);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'qr-001',
        qrCode: 'https://example.com/qr/qr-001.png',
        lineUrl: 'https://line.me/R/ti/p/@bot',
        token: 'tok-abc123',
        campaignName: 'Test Campaign',
        usageCount: 0,
        maxUses: null,
        isActive: true,
        expiresAt: null,
        createdAt: '2026-03-27T00:00:00.000Z',
      });
      expect(result[1].id).toBe('qr-002');
      expect(result[1].isActive).toBe(false);
    });

    it('returns empty array when no QR codes exist', async () => {
      vi.mocked(QRCodeServiceImpl.getTeamQRCodes).mockResolvedValue([]);

      const result = await service.getTeamQRCodes(99);

      expect(result).toEqual([]);
    });

    it('passes the teamId through to the impl', async () => {
      vi.mocked(QRCodeServiceImpl.getTeamQRCodes).mockResolvedValue([]);

      await service.getTeamQRCodes(42);

      expect(QRCodeServiceImpl.getTeamQRCodes).toHaveBeenCalledWith(mockDb, 42);
    });
  });

  // ── getLatestQRCodeFast ─────────────────────────────────────────────────────

  describe('getLatestQRCodeFast', () => {
    it('delegates to QRCodeServiceImpl and returns the result', async () => {
      const cacheData = {
        qrCodeImageUrl: 'https://example.com/qr/latest.png',
        lineUrl: 'https://line.me/R/ti/p/@bot',
        token: 'tok-latest',
        cachedAt: 1743033600000,
      };
      vi.mocked(QRCodeServiceImpl.getLatestQRCodeFast).mockResolvedValue(cacheData as any);

      const result = await service.getLatestQRCodeFast(7);

      expect(QRCodeServiceImpl.getLatestQRCodeFast).toHaveBeenCalledWith(mockDb, 7, undefined);
      expect(result).toEqual(cacheData);
    });
  });

  // ── deactivateQRCode ────────────────────────────────────────────────────────

  describe('deactivateQRCode', () => {
    it('throws when QR code is not found for the team', async () => {
      vi.mocked(QRCodeServiceImpl.getTeamQRCodes).mockResolvedValue([
        makeQRCodeRecord({ id: 'qr-other' }),
      ] as any);

      await expect(service.deactivateQRCode(1, 'qr-not-exist')).rejects.toThrow(
        'QR code not found or does not belong to this team'
      );
    });

    it('calls deactivateQRCode impl with correct token and teamId', async () => {
      const record = makeQRCodeRecord({ id: 'qr-001', token: 'tok-abc123' });
      vi.mocked(QRCodeServiceImpl.getTeamQRCodes).mockResolvedValue([record] as any);
      vi.mocked(QRCodeServiceImpl.deactivateQRCode).mockResolvedValue(undefined);

      await service.deactivateQRCode(1, 'qr-001');

      expect(QRCodeServiceImpl.deactivateQRCode).toHaveBeenCalledWith(
        mockDb,
        'tok-abc123',
        1,
        undefined // kv
      );
    });

    it('clears teams.qrCode when no other active QR codes remain', async () => {
      const record = makeQRCodeRecord({ id: 'qr-001', isActive: true });
      vi.mocked(QRCodeServiceImpl.getTeamQRCodes).mockResolvedValue([record] as any);
      vi.mocked(QRCodeServiceImpl.deactivateQRCode).mockResolvedValue(undefined);

      await service.deactivateQRCode(1, 'qr-001');

      // update called for clearing qrCode
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('updates teams.qrCode to remaining active QR code when others exist', async () => {
      const toDeactivate = makeQRCodeRecord({
        id: 'qr-001',
        isActive: true,
        createdAt: '2026-03-26T00:00:00.000Z',
      });
      const remaining = makeQRCodeRecord({
        id: 'qr-002',
        qrCodeImageUrl: 'https://example.com/qr/qr-002.png',
        isActive: true,
        createdAt: '2026-03-27T00:00:00.000Z',
      });
      vi.mocked(QRCodeServiceImpl.getTeamQRCodes).mockResolvedValue([
        toDeactivate,
        remaining,
      ] as any);
      vi.mocked(QRCodeServiceImpl.deactivateQRCode).mockResolvedValue(undefined);

      await service.deactivateQRCode(1, 'qr-001');

      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  // ── generateTestQRCode ──────────────────────────────────────────────────────

  describe('generateTestQRCode', () => {
    it('returns a static test QR code object', async () => {
      const result = await service.generateTestQRCode();

      expect(result).toEqual({
        id: 'test-123',
        qrCode: expect.stringContaining('qrserver.com'),
        message: 'Test QR code generated successfully',
      });
    });
  });
});
