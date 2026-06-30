import { beforeEach, describe, expect, it, vi } from 'vitest';

const existingAttachment = {
  id: 'existing-att-1',
  messageId: 'msg-1',
  filename: 'existing.jpg',
  mimeType: 'image/jpeg',
  fileSize: 1234,
  fileUrl: 'https://example.com/existing.jpg',
  r2Key: 'media/line/2026/6/existing-att-1.jpg',
  createdAt: '2026-06-30T00:00:00.000Z',
};

const mockExistingGet = vi.fn();
const mockInsertValues = vi.fn().mockResolvedValue({ success: true });
const mockProcessLineMediaMessage = vi.fn();

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: mockExistingGet,
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: mockInsertValues,
    })),
  })),
}));

vi.mock('@/utils/file-storage', () => ({
  processLineMediaMessage: mockProcessLineMediaMessage,
}));

vi.mock('@/utils/timestamp', () => ({
  nowISO: vi.fn(() => '2026-06-30T00:00:00.000Z'),
}));

vi.mock('@/utils/logger', () => ({
  createContextLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((left, right) => ({ left, right })),
}));

vi.mock('@/db/schema', () => ({
  fileAttachments: {
    messageId: 'message_id',
  },
}));

import { processLineMedia } from '@/modules/integrations/services/webhook-media-service';

describe('processLineMedia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistingGet.mockResolvedValue(null);
    mockInsertValues.mockResolvedValue({ success: true });
    mockProcessLineMediaMessage.mockResolvedValue({
      id: 'new-att-1',
      filename: 'new.jpg',
      mimeType: 'image/jpeg',
      size: 5678,
      url: 'https://example.com/new.jpg',
      r2Key: 'media/line/2026/6/new-att-1.jpg',
    });
  });

  it('returns existing attachment and skips LINE download when message was already processed', async () => {
    mockExistingGet.mockResolvedValue(existingAttachment);

    const result = await processLineMedia({ DB: {} } as any, 'msg-1', 'line-msg-1', 'image');

    expect(result).toEqual([existingAttachment]);
    expect(mockProcessLineMediaMessage).not.toHaveBeenCalled();
    expect(mockInsertValues).not.toHaveBeenCalled();
  });
});
