// Tests for src/utils/validate-reply-to.ts
// Validates the centralized replyToMessageId existence check

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ======================== Mock Setup ========================

let mockSelectResult: any = null;

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn().mockImplementation(() => {
    const chain: Record<string, any> = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.from = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockReturnValue(chain);
    chain.get = vi.fn().mockImplementation(() => Promise.resolve(mockSelectResult));
    return chain;
  })
}));

import { validateReplyToMessageId } from '@/utils/validate-reply-to';

// ======================== Tests ========================

describe('validateReplyToMessageId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectResult = null;
  });

  // -------- Null/undefined (skip validation) --------

  it('should return valid for null replyToMessageId', async () => {
    const result = await validateReplyToMessageId({} as D1Database, null);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should return valid for undefined replyToMessageId', async () => {
    const result = await validateReplyToMessageId({} as D1Database, undefined);
    expect(result.valid).toBe(true);
  });

  it('should return valid for empty string replyToMessageId', async () => {
    const result = await validateReplyToMessageId({} as D1Database, '');
    expect(result.valid).toBe(true);
  });

  // -------- Format validation --------

  it('should reject invalid format (not UUID or msg_ prefix)', async () => {
    const result = await validateReplyToMessageId({} as D1Database, 'invalid-id');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('valid message ID format');
  });

  it('should accept valid UUID format', async () => {
    mockSelectResult = { id: '550e8400-e29b-41d4-a716-446655440000' };
    const result = await validateReplyToMessageId(
      {} as D1Database,
      '550e8400-e29b-41d4-a716-446655440000'
    );
    expect(result.valid).toBe(true);
  });

  it('should accept msg_ prefixed IDs', async () => {
    mockSelectResult = { id: 'msg_1234567890_abc123def' };
    const result = await validateReplyToMessageId(
      {} as D1Database,
      'msg_1234567890_abc123def'
    );
    expect(result.valid).toBe(true);
  });

  // -------- Existence validation --------

  it('should return invalid when referenced message does not exist', async () => {
    mockSelectResult = null; // Message not found
    const result = await validateReplyToMessageId(
      {} as D1Database,
      '550e8400-e29b-41d4-a716-446655440000'
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain('does not exist');
    expect(result.error).toContain('550e8400-e29b-41d4-a716-446655440000');
  });

  it('should return valid when referenced message exists', async () => {
    mockSelectResult = { id: '550e8400-e29b-41d4-a716-446655440000' };
    const result = await validateReplyToMessageId(
      {} as D1Database,
      '550e8400-e29b-41d4-a716-446655440000'
    );
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  // -------- Same-conversation constraint --------

  it('should include conversation scope in error when conversationId provided', async () => {
    mockSelectResult = null;
    const result = await validateReplyToMessageId(
      {} as D1Database,
      '550e8400-e29b-41d4-a716-446655440000',
      'conv-123'
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain('in this conversation');
  });

  it('should NOT include conversation scope when conversationId omitted', async () => {
    mockSelectResult = null;
    const result = await validateReplyToMessageId(
      {} as D1Database,
      '550e8400-e29b-41d4-a716-446655440000'
    );
    expect(result.valid).toBe(false);
    expect(result.error).not.toContain('in this conversation');
  });

  // -------- DB error handling (fail-open) --------

  it('should return valid on DB error (fail-open for availability)', async () => {
    const { createDbClient } = await import('@/db/drizzle-factory');
    (createDbClient as any).mockImplementationOnce(() => {
      const chain: Record<string, any> = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.get = vi.fn().mockRejectedValue(new Error('DB connection failed'));
      return chain;
    });

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await validateReplyToMessageId(
      {} as D1Database,
      '550e8400-e29b-41d4-a716-446655440000'
    );
    expect(result.valid).toBe(true);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('DB check failed'),
      expect.anything()
    );
    consoleSpy.mockRestore();
  });
});
