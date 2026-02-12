import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FacebookAdapter, createPlatformAdapter } from '@backend/integrations/platform-adapter';

describe('Facebook Integration Tests', () => {
  const mockAppSecret = 'test-app-secret';
  const mockPageAccessToken = 'test-page-access-token';
  let facebookAdapter: FacebookAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    facebookAdapter = new FacebookAdapter(mockAppSecret, mockPageAccessToken);
  });

  describe('FacebookAdapter', () => {
    test('should send text message successfully', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await facebookAdapter.sendTextMessage('user123', 'Hello World');

      expect(result).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[FacebookAdapter]')
      );

      consoleSpy.mockRestore();
    });

    test('should send image message successfully', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await facebookAdapter.sendImageMessage('user123', 'https://example.com/image.jpg');

      expect(result).toBe(true);

      consoleSpy.mockRestore();
    });

    test('should send video message successfully', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await facebookAdapter.sendVideoMessage('user123', 'https://example.com/video.mp4');

      expect(result).toBe(true);

      consoleSpy.mockRestore();
    });

    test('should send audio message successfully', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await facebookAdapter.sendAudioMessage('user123', 'https://example.com/audio.mp3');

      expect(result).toBe(true);

      consoleSpy.mockRestore();
    });

    test('should send file message successfully', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await facebookAdapter.sendFileMessage('user123', 'https://example.com/doc.pdf', 'doc.pdf');

      expect(result).toBe(true);

      consoleSpy.mockRestore();
    });
  });

  describe('createPlatformAdapter', () => {
    test('should create FacebookAdapter for facebook platform', () => {
      const adapter = createPlatformAdapter('facebook', {
        appSecret: mockAppSecret,
        pageAccessToken: mockPageAccessToken
      });

      expect(adapter).toBeInstanceOf(FacebookAdapter);
    });

    test('should create LineAdapter for line platform', () => {
      const adapter = createPlatformAdapter('line', {
        channelAccessToken: 'test-token',
        channelSecret: 'test-secret'
      });

      expect(adapter).toBeDefined();
    });

    test('should throw for unsupported platform', () => {
      expect(() => {
        createPlatformAdapter('unknown' as any, {});
      }).toThrow('Unsupported platform: unknown');
    });
  });
});
