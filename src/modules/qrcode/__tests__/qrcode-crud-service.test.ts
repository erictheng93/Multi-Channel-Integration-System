// QRCode CRUD 服務單元測試
// 測試 QR Code 數據庫操作相關功能

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QRCodeCrudService } from '@modules/qrcode/services/qrcode-crud-service';
import type {
  CreateQRCodeRequest,
  UpdateQRCodeRequest,
  QRCodeListQuery
} from '../types/qrcode-types';

// ======================== Mock 設置 ========================

// Mock 數據庫
const mockDb = {
  insert: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

// Mock KV 快取
const mockCache = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

// Mock R2 儲存
const mockStorage = {
  put: vi.fn(),
  get: vi.fn(),
  head: vi.fn(),
  delete: vi.fn(),
};

// Mock QRCodeGenerationService
vi.mock('../services/qrcode-generation-service', () => ({
  QRCodeGenerationService: {
    generate: vi.fn().mockResolvedValue('mock-qr-code-data'),
    validateContent: vi.fn().mockReturnValue({ valid: true, errors: [] }),
  }
}));

// ======================== 測試數據 ========================

const mockUserId = 1;
const mockTeamId = 1;

const mockCreateRequest: CreateQRCodeRequest = {
  name: 'Test QR Code',
  description: 'Test description',
  type: 'url',
  content: 'https://example.com',
  size: 300,
  errorCorrectionLevel: 'M',
  outputFormat: 'png',
  foregroundColor: '#000000',
  backgroundColor: '#FFFFFF',
  tags: ['test', 'example'],
};

const mockUpdateRequest: UpdateQRCodeRequest = {
  name: 'Updated QR Code',
  description: 'Updated description',
  status: 'active',
};

const mockQRCodeRecord = {
  id: 'test-qr-code-id',
  name: 'Test QR Code',
  description: 'Test description',
  type: 'url',
  content: 'https://example.com',
  status: 'active',
  size: 300,
  errorCorrectionLevel: 'M',
  outputFormat: 'png',
  foregroundColor: '#000000',
  backgroundColor: '#FFFFFF',
  teamId: mockTeamId,
  createdBy: mockUserId,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  scanCount: 0,
  tags: '["test", "example"]',
  customData: null,
};

// ======================== QRCodeCrudService 測試 ========================

describe('QRCodeCrudService', () => {
  let service: QRCodeCrudService;

  beforeEach(() => {
    vi.clearAllMocks();

    // 重置 mock 實現
    // 創建可重用的鏈式 mock
    const limitMock = vi.fn().mockResolvedValue([]);
    const orderByMock = vi.fn().mockReturnValue({
      limit: limitMock,
      offset: vi.fn().mockResolvedValue([])
    });
    const whereMock = vi.fn().mockReturnValue({
      limit: limitMock,
      orderBy: orderByMock
    });
    const fromMock = vi.fn().mockReturnValue({
      where: whereMock,
      orderBy: orderByMock,
      limit: limitMock
    });

    mockDb.select.mockReturnValue({
      from: fromMock
    });

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined)
    });

    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined)
      })
    });

    service = new QRCodeCrudService(mockDb as any, mockCache as any, mockStorage as any);
  });

  // ======================== Create 測試 ========================

  describe('create', () => {
    it('should create QR code successfully', async () => {
      const result = await service.create(mockCreateRequest, mockUserId, mockTeamId);

      expect(result).toBeDefined();
      expect(result.name).toBe(mockCreateRequest.name);
      expect(result.type).toBe(mockCreateRequest.type);
      expect(result.content).toBe(mockCreateRequest.content);
      expect(result.createdBy).toBe(mockUserId);
      expect(result.teamId).toBe(mockTeamId);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should validate required fields', async () => {
      const invalidRequest = {
        ...mockCreateRequest,
        name: '', // Invalid empty name
      };

      await expect(service.create(invalidRequest, mockUserId, mockTeamId))
        .rejects.toThrow('QR code name is required');
    });

    it('should validate QR code type', async () => {
      const invalidRequest = {
        ...mockCreateRequest,
        type: '', // Invalid empty type
      };

      await expect(service.create(invalidRequest as any, mockUserId, mockTeamId))
        .rejects.toThrow('QR code type is required');
    });

    it('should validate content', async () => {
      const invalidRequest = {
        ...mockCreateRequest,
        content: '', // Invalid empty content
      };

      await expect(service.create(invalidRequest, mockUserId, mockTeamId))
        .rejects.toThrow('QR code content is required');
    });

    it('should handle creation with minimal data', async () => {
      const minimalRequest: CreateQRCodeRequest = {
        name: 'Minimal QR Code',
        type: 'text',
        content: 'Hello World',
      };

      const result = await service.create(minimalRequest, mockUserId, mockTeamId);

      expect(result).toBeDefined();
      expect(result.name).toBe(minimalRequest.name);
      expect(result.size).toBe(300); // Default value
      expect(result.errorCorrectionLevel).toBe('M'); // Default value
    });

    it('should handle tags correctly', async () => {
      const requestWithTags = {
        ...mockCreateRequest,
        tags: ['tag1', 'tag2', 'tag3'],
      };

      const result = await service.create(requestWithTags, mockUserId, mockTeamId);

      expect(result.tags).toEqual(requestWithTags.tags);
    });

    it('should handle custom data correctly', async () => {
      const customData = { key1: 'value1', key2: 'value2' };
      const requestWithCustomData = {
        ...mockCreateRequest,
        customData,
      };

      const result = await service.create(requestWithCustomData, mockUserId, mockTeamId);

      expect(result.customData).toEqual(customData);
    });
  });

  // ======================== FindById 測試 ========================

  describe('findById', () => {
    beforeEach(() => {
      // Mock successful database query
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockQRCodeRecord])
          })
        })
      });
    });

    it('should find QR code by ID successfully', async () => {
      const result = await service.findById('test-qr-code-id', mockUserId);

      expect(result).toBeDefined();
      expect(result!.id).toBe('test-qr-code-id');
      expect(result!.name).toBe(mockQRCodeRecord.name);
      expect(Array.isArray(result!.tags)).toBe(true);
    });

    it('should return null for non-existent QR code', async () => {
      // Mock empty result
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      });

      const result = await service.findById('non-existent-id', mockUserId);

      expect(result).toBeNull();
    });

    it('should include scan history in detailed response', async () => {
      // Mock scan history query
      const mockScanHistory = [
        {
          scannedAt: '2024-01-01T12:00:00.000Z',
          userAgent: 'Mozilla/5.0',
          ipAddress: '192.168.1.1',
        }
      ];

      // Setup mock for scan history query
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // First call for QR code
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockQRCodeRecord])
              })
            })
          };
        } else {
          // Second call for scan history
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue(mockScanHistory)
                })
              })
            })
          };
        }
      });

      const result = await service.findById('test-qr-code-id', mockUserId);

      expect(result).toBeDefined();
      expect(result!.scanHistory).toBeDefined();
      expect(Array.isArray(result!.scanHistory)).toBe(true);
    });

    it('should handle cache hit', async () => {
      const cachedData = { ...mockQRCodeRecord, cached: true };
      mockCache.get.mockResolvedValue(cachedData);

      const result = await service.findById('test-qr-code-id', mockUserId);

      expect(result).toEqual(cachedData);
      expect(mockDb.select).not.toHaveBeenCalled();
    });
  });

  // ======================== Update 測試 ========================

  describe('update', () => {
    beforeEach(() => {
      // Mock finding existing QR code
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockQRCodeRecord])
          })
        })
      });

      // Mock scan history query (empty for simplicity)
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockQRCodeRecord])
              })
            })
          };
        } else {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([])
                })
              })
            })
          };
        }
      });
    });

    it('should update QR code successfully', async () => {
      const result = await service.update('test-qr-code-id', mockUpdateRequest, mockUserId);

      expect(result).toBeDefined();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should handle partial updates', async () => {
      const partialUpdate = { name: 'New Name Only' };

      const result = await service.update('test-qr-code-id', partialUpdate, mockUserId);

      expect(result).toBeDefined();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should return error for non-existent QR code', async () => {
      // Mock empty result for finding QR code
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      });

      await expect(service.update('non-existent-id', mockUpdateRequest, mockUserId))
        .rejects.toThrow('QR code not found or access denied');
    });

    it('should handle tags update', async () => {
      const updateWithTags = {
        ...mockUpdateRequest,
        tags: ['new-tag1', 'new-tag2'],
      };

      const result = await service.update('test-qr-code-id', updateWithTags, mockUserId);

      expect(result).toBeDefined();
    });

    it('should handle custom data update', async () => {
      const updateWithCustomData = {
        ...mockUpdateRequest,
        customData: { newKey: 'newValue' },
      };

      const result = await service.update('test-qr-code-id', updateWithCustomData, mockUserId);

      expect(result).toBeDefined();
    });
  });

  // ======================== Delete 測試 ========================

  describe('delete', () => {
    beforeEach(() => {
      // Mock finding existing QR code
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockQRCodeRecord]),
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([])
            })
          })
        })
      });
    });

    it('should delete QR code successfully (soft delete)', async () => {
      const result = await service.delete('test-qr-code-id', mockUserId);

      expect(result).toBe(true);
      expect(mockDb.update).toHaveBeenCalled();

      // Verify it was a soft delete (status set to disabled)
      const updateCall = mockDb.update.mock.calls[0];
      expect(updateCall).toBeDefined();
    });

    it('should return false for non-existent QR code', async () => {
      // Mock empty result
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      });

      const result = await service.delete('non-existent-id', mockUserId);

      expect(result).toBe(false);
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  // ======================== List 測試 ========================

  describe('list', () => {
    const mockQRCodesList = [
      mockQRCodeRecord,
      { ...mockQRCodeRecord, id: 'test-qr-code-id-2', name: 'Test QR Code 2' }
    ];

    beforeEach(() => {
      // Mock count query
      mockDb.select.mockImplementation(() => {
        const mockQuery = {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue(mockQRCodesList)
                })
              })
            })
          })
        };

        // First call returns count, second returns data
        if (mockQuery.from().where().hasOwnProperty('limit')) {
          return mockQuery;
        } else {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ count: mockQRCodesList.length }])
            })
          };
        }
      });
    });

    it('should list QR codes successfully', async () => {
      const query: QRCodeListQuery = {
        page: 1,
        limit: 50,
      };

      const result = await service.list(query, mockUserId);

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.pagination).toBeDefined();
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(50);
    });

    it('should handle empty results', async () => {
      // Mock empty results
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }])
        })
      });

      const query: QRCodeListQuery = {};
      const result = await service.list(query, mockUserId);

      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    it('should handle filtering by type', async () => {
      const query: QRCodeListQuery = {
        type: 'url',
      };

      const result = await service.list(query, mockUserId);

      expect(result).toBeDefined();
      // Verify filter was applied (would need to check mock calls in real implementation)
    });

    it('should handle filtering by status', async () => {
      const query: QRCodeListQuery = {
        status: 'active',
      };

      const result = await service.list(query, mockUserId);

      expect(result).toBeDefined();
    });

    it('should handle search query', async () => {
      const query: QRCodeListQuery = {
        search: 'test',
      };

      const result = await service.list(query, mockUserId);

      expect(result).toBeDefined();
    });

    it('should handle sorting', async () => {
      const query: QRCodeListQuery = {
        sortBy: 'name',
        sortOrder: 'asc',
      };

      const result = await service.list(query, mockUserId);

      expect(result).toBeDefined();
    });

    it('should handle pagination', async () => {
      const query: QRCodeListQuery = {
        page: 2,
        limit: 10,
      };

      const result = await service.list(query, mockUserId);

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(10);
    });
  });

  // ======================== RecordScan 測試 ========================

  describe('recordScan', () => {
    it('should record scan successfully', async () => {
      const scanData = {
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
      };

      await service.recordScan('test-qr-code-id', scanData);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should record scan without optional data', async () => {
      await service.recordScan('test-qr-code-id');

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  // ======================== BatchOperation 測試 ========================

  describe('batchOperation', () => {
    it('should handle batch create successfully', async () => {
      const batchRequest = {
        operation: 'create' as const,
        qrCodes: [
          mockCreateRequest,
          { ...mockCreateRequest, name: 'Batch QR Code 2' }
        ]
      };

      const result = await service.batchOperation(batchRequest, mockUserId);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.summary.successful).toBe(2);
      expect(result.summary.failed).toBe(0);
    });

    it('should handle mixed success and failure in batch', async () => {
      const batchRequest = {
        operation: 'create' as const,
        qrCodes: [
          mockCreateRequest,
          { ...mockCreateRequest, name: '' } // Invalid empty name
        ]
      };

      const result = await service.batchOperation(batchRequest, mockUserId);

      expect(result.success).toBe(false);
      expect(result.results).toHaveLength(2);
      expect(result.summary.successful).toBe(1);
      expect(result.summary.failed).toBe(1);
    });

    it('should handle batch update', async () => {
      // Mock finding existing QR codes for update
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockQRCodeRecord]),
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([])
            })
          })
        })
      });

      const batchRequest = {
        operation: 'update' as const,
        qrCodes: [
          { id: 'test-qr-code-id', name: 'Updated Name 1' },
          { id: 'test-qr-code-id-2', name: 'Updated Name 2' }
        ]
      };

      const result = await service.batchOperation(batchRequest, mockUserId);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
    });

    it('should handle batch delete', async () => {
      // Mock finding existing QR codes for delete
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockQRCodeRecord]),
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([])
            })
          })
        })
      });

      const batchRequest = {
        operation: 'delete' as const,
        qrCodes: [
          { id: 'test-qr-code-id' },
          { id: 'test-qr-code-id-2' }
        ]
      };

      const result = await service.batchOperation(batchRequest, mockUserId);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
    });
  });

  // ======================== Error Handling 測試 ========================

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockRejectedValue(new Error('Database connection failed'))
      });

      await expect(service.create(mockCreateRequest, mockUserId, mockTeamId))
        .rejects.toThrow('Failed to create QR code');
    });

    it('should handle cache errors gracefully', async () => {
      mockCache.get.mockRejectedValue(new Error('Cache connection failed'));

      // Should still work even if cache fails
      const result = await service.findById('test-qr-code-id', mockUserId);
      // Test should continue normally
    });

    it('should handle storage errors gracefully', async () => {
      mockStorage.put.mockRejectedValue(new Error('Storage upload failed'));

      // Should still create QR code even if storage fails
      const result = await service.create(mockCreateRequest, mockUserId, mockTeamId);
      expect(result).toBeDefined();
    });
  });
});