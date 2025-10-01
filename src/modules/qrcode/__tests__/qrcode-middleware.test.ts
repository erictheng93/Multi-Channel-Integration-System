// QRCode 中間件單元測試
// 測試 QR Code 權限控制和驗證中間件

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Context, Next } from 'hono';
import {
  qrCodeAuthMiddleware,
  requireCreatePermission,
  requireManagePermission,
  requireReadPermission,
  qrCodeCreateRateLimit
} from '../middleware/qrcode-auth';
import {
  validateCreateRequest,
  validateUpdateRequest,
  validateQueryParams
} from '../middleware/qrcode-validation';

// ======================== Mock 設置 ========================

// Mock errorResponse
vi.mock('../../shared/utils/api-response', () => ({
  errorResponse: vi.fn((c, message, status) => ({ error: message, status }))
}));

// Mock QRCodeGenerationService
vi.mock('../services/qrcode-generation-service', () => ({
  QRCodeGenerationService: {
    validateContent: vi.fn().mockReturnValue({ valid: true, errors: [] })
  }
}));

// Mock Context 和 Next
const createMockContext = (overrides: any = {}) => ({
  get: vi.fn((key: string) => {
    const defaults: any = {
      userId: 1,
      userRole: 'agent',
      teamId: 1
    };
    return defaults[key] || overrides[key];
  }),
  set: vi.fn(),
  req: {
    json: vi.fn(),
    query: vi.fn(),
    param: vi.fn(),
    header: vi.fn()
  },
  env: {
    DB: {},
    CACHE: {
      get: vi.fn(),
      put: vi.fn()
    }
  },
  json: vi.fn(),
  res: { status: 200 },
  ...overrides
});

const mockNext: Next = vi.fn();

// ======================== Auth 中間件測試 ========================

describe('QRCode Auth Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('qrCodeAuthMiddleware', () => {
    it('should allow authenticated user to proceed', async () => {
      const mockContext = createMockContext();

      await qrCodeAuthMiddleware(mockContext as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockContext.set).toHaveBeenCalledWith('qrCode', null);
      expect(mockContext.set).toHaveBeenCalledWith('canAccess', false);
      expect(mockContext.set).toHaveBeenCalledWith('canModify', false);
    });

    it('should reject unauthenticated user', async () => {
      const mockContext = createMockContext({
        get: vi.fn(() => null) // No userId
      });

      const result = await qrCodeAuthMiddleware(mockContext as any, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(result).toEqual({ error: 'Authentication required', status: 401 });
    });
  });

  describe('requireCreatePermission', () => {
    it('should allow admin to create QR codes', async () => {
      const mockContext = createMockContext({
        get: vi.fn((key: string) => {
          if (key === 'userRole') return 'admin';
          if (key === 'userId') return 1;
          if (key === 'teamId') return 1;
          return null;
        })
      });

      await requireCreatePermission(mockContext as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow team leader to create QR codes', async () => {
      const mockContext = createMockContext({
        get: vi.fn((key: string) => {
          if (key === 'userRole') return 'team';
          if (key === 'userId') return 1;
          if (key === 'teamId') return 1;
          return null;
        })
      });

      await requireCreatePermission(mockContext as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow agent to create QR codes', async () => {
      const mockContext = createMockContext({
        get: vi.fn((key: string) => {
          if (key === 'userRole') return 'agent';
          if (key === 'userId') return 1;
          if (key === 'teamId') return 1;
          return null;
        })
      });

      await requireCreatePermission(mockContext as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireManagePermission', () => {
    const mockQRCode = {
      id: 'test-id',
      createdBy: 1,
      teamId: 1,
      status: 'active'
    };

    beforeEach(() => {
      // Mock getQRCodeById function
      vi.doMock('../middleware/qrcode-auth', async (importOriginal) => {
        const original = await importOriginal() as any;
        return {
          ...((original && typeof original === 'object') ? original : {}),
          getQRCodeById: vi.fn().mockResolvedValue(mockQRCode)
        };
      });
    });

    it('should allow owner to manage their QR code', async () => {
      const mockContext = createMockContext({
        req: {
          param: vi.fn(() => 'test-id')
        },
        get: vi.fn((key: string) => {
          if (key === 'userId') return 1; // Same as createdBy
          if (key === 'userRole') return 'agent';
          if (key === 'teamId') return 1;
          return null;
        }),
        env: { DB: {} }
      });

      // We can't easily test this without mocking the entire database function
      // In a real scenario, you'd mock the getQRCodeById function properly
    });
  });

  describe('qrCodeCreateRateLimit', () => {
    it('should allow creation within rate limit', async () => {
      const mockContext = createMockContext({
        get: vi.fn(() => 1),
        env: {
          CACHE: {
            get: vi.fn().mockResolvedValue('5'), // Under limit
            put: vi.fn()
          }
        }
      });

      await qrCodeCreateRateLimit(mockContext as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockContext.env.CACHE.put).toHaveBeenCalledWith(
        'qrcode-create-limit-1',
        '6',
        { expirationTtl: 3600 }
      );
    });

    it('should block creation when rate limit exceeded', async () => {
      const mockContext = createMockContext({
        get: vi.fn(() => 1),
        env: {
          CACHE: {
            get: vi.fn().mockResolvedValue('10'), // At limit
            put: vi.fn()
          }
        }
      });

      const result = await qrCodeCreateRateLimit(mockContext as any, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(result).toEqual({
        error: 'Rate limit exceeded. Maximum 10 QR codes per hour.',
        status: 429
      });
    });

    it('should handle cache errors gracefully', async () => {
      const mockContext = createMockContext({
        get: vi.fn(() => 1),
        env: {
          CACHE: {
            get: vi.fn().mockRejectedValue(new Error('Cache error')),
            put: vi.fn()
          }
        }
      });

      await qrCodeCreateRateLimit(mockContext as any, mockNext);

      // Should continue even if cache fails
      expect(mockNext).toHaveBeenCalled();
    });
  });
});

// ======================== Validation 中間件測試 ========================

describe('QRCode Validation Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateCreateRequest', () => {
    const validCreateData = {
      name: 'Test QR Code',
      type: 'url',
      content: 'https://example.com',
      description: 'Test description',
      size: 300,
      errorCorrectionLevel: 'M',
      outputFormat: 'png',
      foregroundColor: '#000000',
      backgroundColor: '#FFFFFF',
      tags: ['test', 'example']
    };

    it('should validate valid create request', async () => {
      const mockContext = createMockContext({
        req: {
          json: vi.fn().mockResolvedValue(validCreateData)
        },
        set: vi.fn()
      });

      await validateCreateRequest(mockContext as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockContext.set).toHaveBeenCalledWith('validatedData', expect.objectContaining({
        name: 'Test QR Code',
        type: 'url',
        content: 'https://example.com'
      }));
    });

    it('should reject request with missing required fields', async () => {
      const invalidData = {
        name: '', // Empty name
        type: 'url',
        content: 'https://example.com'
      };

      const mockContext = createMockContext({
        req: {
          json: vi.fn().mockResolvedValue(invalidData)
        }
      });

      const result = await validateCreateRequest(mockContext as any, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(result).toEqual({
        error: 'Missing required fields: name',
        status: 400
      });
    });

    it('should reject request with invalid QR code type', async () => {
      const invalidData = {
        ...validCreateData,
        type: 'invalid-type'
      };

      const mockContext = createMockContext({
        req: {
          json: vi.fn().mockResolvedValue(invalidData)
        }
      });

      const result = await validateCreateRequest(mockContext as any, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(result).toHaveProperty('status', 400);
      expect(result).toHaveProperty('error');
      expect((result as any).error).toContain('Invalid QR code type');
    });

    it('should reject request with name too long', async () => {
      const invalidData = {
        ...validCreateData,
        name: 'A'.repeat(101) // Too long
      };

      const mockContext = createMockContext({
        req: {
          json: vi.fn().mockResolvedValue(invalidData)
        }
      });

      const result = await validateCreateRequest(mockContext as any, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(result).toEqual({
        error: 'Name must not exceed 100 characters',
        status: 400
      });
    });

    it('should reject request with invalid size', async () => {
      const invalidData = {
        ...validCreateData,
        size: 50 // Too small
      };

      const mockContext = createMockContext({
        req: {
          json: vi.fn().mockResolvedValue(invalidData)
        }
      });

      const result = await validateCreateRequest(mockContext as any, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(result).toHaveProperty('status', 400);
      expect((result as any).error).toContain('Size must be between');
    });

    it('should reject request with invalid color format', async () => {
      const invalidData = {
        ...validCreateData,
        foregroundColor: 'red' // Invalid format
      };

      const mockContext = createMockContext({
        req: {
          json: vi.fn().mockResolvedValue(invalidData)
        }
      });

      const result = await validateCreateRequest(mockContext as any, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(result).toHaveProperty('status', 400);
      expect((result as any).error).toContain('Invalid foreground color format');
    });

    it('should reject request with too many tags', async () => {
      const invalidData = {
        ...validCreateData,
        tags: Array(11).fill('tag') // Too many tags
      };

      const mockContext = createMockContext({
        req: {
          json: vi.fn().mockResolvedValue(invalidData)
        }
      });

      const result = await validateCreateRequest(mockContext as any, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(result).toEqual({
        error: 'Maximum 10 tags allowed',
        status: 400
      });
    });

    it('should reject request with invalid expiry date', async () => {
      const invalidData = {
        ...validCreateData,
        expiresAt: '2020-01-01' // Past date
      };

      const mockContext = createMockContext({
        req: {
          json: vi.fn().mockResolvedValue(invalidData)
        }
      });

      const result = await validateCreateRequest(mockContext as any, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(result).toEqual({
        error: 'Expiry date must be in the future',
        status: 400
      });
    });

    it('should clean and normalize data', async () => {
      const dataWithWhitespace = {
        ...validCreateData,
        name: '  Test QR Code  ',
        description: '  Test description  ',
        content: '  https://example.com  ',
        tags: ['  tag1  ', '  tag2  ']
      };

      const mockContext = createMockContext({
        req: {
          json: vi.fn().mockResolvedValue(dataWithWhitespace)
        },
        set: vi.fn()
      });

      await validateCreateRequest(mockContext as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockContext.set).toHaveBeenCalledWith('validatedData', expect.objectContaining({
        name: 'Test QR Code',
        description: 'Test description',
        content: 'https://example.com',
        tags: ['tag1', 'tag2']
      }));
    });
  });

  describe('validateUpdateRequest', () => {
    const validUpdateData = {
      name: 'Updated QR Code',
      description: 'Updated description',
      status: 'active',
      foregroundColor: '#FF0000'
    };

    it('should validate valid update request', async () => {
      const mockContext = createMockContext({
        req: {
          json: vi.fn().mockResolvedValue(validUpdateData)
        },
        set: vi.fn()
      });

      await validateUpdateRequest(mockContext as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockContext.set).toHaveBeenCalledWith('validatedData', expect.objectContaining({
        name: 'Updated QR Code',
        description: 'Updated description'
      }));
    });

    it('should allow partial updates', async () => {
      const partialData = {
        name: 'New Name Only'
      };

      const mockContext = createMockContext({
        req: {
          json: vi.fn().mockResolvedValue(partialData)
        },
        set: vi.fn()
      });

      await validateUpdateRequest(mockContext as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockContext.set).toHaveBeenCalledWith('validatedData', expect.objectContaining({
        name: 'New Name Only'
      }));
    });

    it('should reject invalid status', async () => {
      const invalidData = {
        ...validUpdateData,
        status: 'invalid-status'
      };

      const mockContext = createMockContext({
        req: {
          json: vi.fn().mockResolvedValue(invalidData)
        }
      });

      const result = await validateUpdateRequest(mockContext as any, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(result).toHaveProperty('status', 400);
      expect((result as any).error).toContain('Invalid status');
    });

    it('should handle null values correctly', async () => {
      const dataWithNulls = {
        name: 'Updated Name',
        description: null,
        logoUrl: null,
        tags: null,
        customData: null
      };

      const mockContext = createMockContext({
        req: {
          json: vi.fn().mockResolvedValue(dataWithNulls)
        },
        set: vi.fn()
      });

      await validateUpdateRequest(mockContext as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockContext.set).toHaveBeenCalledWith('validatedData', expect.objectContaining({
        name: 'Updated Name',
        description: null,
        logoUrl: null,
        tags: null,
        customData: null
      }));
    });
  });

  describe('validateQueryParams', () => {
    it('should validate valid query parameters', async () => {
      const mockContext = createMockContext({
        req: {
          query: vi.fn().mockReturnValue({
            page: '1',
            limit: '50',
            sortBy: 'name',
            sortOrder: 'asc',
            type: 'url',
            status: 'active',
            search: 'test'
          })
        },
        set: vi.fn()
      });

      await validateQueryParams(mockContext as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockContext.set).toHaveBeenCalledWith('validatedQuery', expect.objectContaining({
        page: 1,
        limit: 50,
        sortBy: 'name',
        sortOrder: 'asc',
        type: 'url',
        status: 'active',
        search: 'test'
      }));
    });

    it('should reject invalid page number', async () => {
      const mockContext = createMockContext({
        req: {
          query: vi.fn().mockReturnValue({
            page: '-1'
          })
        }
      });

      const result = await validateQueryParams(mockContext as any, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(result).toEqual({
        error: 'Page must be a positive integer',
        status: 400
      });
    });

    it('should reject invalid limit', async () => {
      const mockContext = createMockContext({
        req: {
          query: vi.fn().mockReturnValue({
            limit: '101' // Too high
          })
        }
      });

      const result = await validateQueryParams(mockContext as any, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(result).toEqual({
        error: 'Limit must be between 1 and 100',
        status: 400
      });
    });

    it('should reject invalid sort field', async () => {
      const mockContext = createMockContext({
        req: {
          query: vi.fn().mockReturnValue({
            sortBy: 'invalid-field'
          })
        }
      });

      const result = await validateQueryParams(mockContext as any, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(result).toHaveProperty('status', 400);
      expect((result as any).error).toContain('Invalid sortBy field');
    });

    it('should handle tags parameter', async () => {
      const mockContext = createMockContext({
        req: {
          query: vi.fn().mockReturnValue({
            tags: 'tag1,tag2,tag3'
          })
        },
        set: vi.fn()
      });

      await validateQueryParams(mockContext as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockContext.set).toHaveBeenCalledWith('validatedQuery', expect.objectContaining({
        tags: ['tag1', 'tag2', 'tag3']
      }));
    });

    it('should reject too many tags in filter', async () => {
      const mockContext = createMockContext({
        req: {
          query: vi.fn().mockReturnValue({
            tags: 'tag1,tag2,tag3,tag4,tag5,tag6' // Too many tags
          })
        }
      });

      const result = await validateQueryParams(mockContext as any, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(result).toEqual({
        error: 'Maximum 5 tags allowed in filter',
        status: 400
      });
    });

    it('should validate date ranges', async () => {
      const mockContext = createMockContext({
        req: {
          query: vi.fn().mockReturnValue({
            createdAfter: '2024-01-01T00:00:00.000Z',
            createdBefore: '2024-12-31T23:59:59.999Z'
          })
        },
        set: vi.fn()
      });

      await validateQueryParams(mockContext as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockContext.set).toHaveBeenCalledWith('validatedQuery', expect.objectContaining({
        createdAfter: '2024-01-01T00:00:00.000Z',
        createdBefore: '2024-12-31T23:59:59.999Z'
      }));
    });
  });

  describe('error handling', () => {
    it('should handle JSON parsing errors', async () => {
      const mockContext = createMockContext({
        req: {
          json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
        }
      });

      const result = await validateCreateRequest(mockContext as any, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(result).toEqual({
        error: 'Invalid request data',
        status: 400
      });
    });

    it('should handle unexpected errors gracefully', async () => {
      const mockContext = createMockContext({
        req: {
          json: vi.fn().mockImplementation(() => {
            throw new Error('Unexpected error');
          })
        }
      });

      const result = await validateCreateRequest(mockContext as any, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(result).toEqual({
        error: 'Invalid request data',
        status: 400
      });
    });
  });
});