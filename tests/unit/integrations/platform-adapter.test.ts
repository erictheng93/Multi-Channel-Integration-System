/**
 * Platform Adapter Unit Tests
 * 平台適配器單元測試
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LineAdapter,
  FacebookAdapter,
  createPlatformAdapter,
  type PlatformAdapter
} from '@/integrations/platform-adapter';

describe('Platform Adapter', () => {
  describe('LineAdapter', () => {
    let lineAdapter: LineAdapter;
    const mockChannelAccessToken = 'test_channel_access_token';
    const mockChannelSecret = 'test_channel_secret';

    beforeEach(() => {
      lineAdapter = new LineAdapter(mockChannelAccessToken, mockChannelSecret);
      // Mock console.log to avoid cluttering test output
      vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    it('應該能夠創建 LineAdapter 實例', () => {
      expect(lineAdapter).toBeDefined();
      expect(lineAdapter).toBeInstanceOf(LineAdapter);
    });

    it('應該能夠發送文字訊息', async () => {
      const userId = 'test_user_123';
      const text = 'Hello from LINE!';

      const result = await lineAdapter.sendTextMessage(userId, text);

      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[LineAdapter]'),
      );
    });

    it('應該能夠發送圖片訊息', async () => {
      const userId = 'test_user_123';
      const imageUrl = 'https://example.com/image.jpg';

      const result = await lineAdapter.sendImageMessage(userId, imageUrl);

      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Sending image message')
      );
    });

    it('應該能夠發送影片訊息', async () => {
      const userId = 'test_user_123';
      const videoUrl = 'https://example.com/video.mp4';

      const result = await lineAdapter.sendVideoMessage(userId, videoUrl);

      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Sending video message')
      );
    });

    it('應該能夠發送音訊訊息', async () => {
      const userId = 'test_user_123';
      const audioUrl = 'https://example.com/audio.mp3';

      const result = await lineAdapter.sendAudioMessage(userId, audioUrl);

      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Sending audio message')
      );
    });

    it('應該能夠發送檔案訊息', async () => {
      const userId = 'test_user_123';
      const fileUrl = 'https://example.com/document.pdf';
      const filename = 'document.pdf';

      const result = await lineAdapter.sendFileMessage(userId, fileUrl, filename);

      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Sending file message')
      );
    });

    it('應該能夠發送多條訊息', async () => {
      const userId = 'test_user_123';
      const messages = [
        { type: 'text', content: 'Message 1' },
        { type: 'text', content: 'Message 2' },
        { type: 'image', content: 'https://example.com/image.jpg' }
      ];

      const result = await lineAdapter.sendMultipleMessages(userId, messages);

      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Sending 3 messages')
      );
    });

    it('應該在 log 中包含 token 資訊（遮罩）', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log');

      await lineAdapter.sendTextMessage('user_123', 'Test message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('test_chann')  // 前10個字符
      );
    });
  });

  describe('FacebookAdapter', () => {
    let facebookAdapter: FacebookAdapter;
    const mockAppSecret = 'test_app_secret';
    const mockPageAccessToken = 'test_page_access_token';

    beforeEach(() => {
      facebookAdapter = new FacebookAdapter(mockAppSecret, mockPageAccessToken);
      vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    it('應該能夠創建 FacebookAdapter 實例', () => {
      expect(facebookAdapter).toBeDefined();
      expect(facebookAdapter).toBeInstanceOf(FacebookAdapter);
    });

    it('應該能夠發送文字訊息', async () => {
      const userId = 'test_facebook_user_123';
      const text = 'Hello from Facebook!';

      const result = await facebookAdapter.sendTextMessage(userId, text);

      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[FacebookAdapter]')
      );
    });

    it('應該能夠發送圖片訊息', async () => {
      const userId = 'test_facebook_user_123';
      const imageUrl = 'https://example.com/facebook-image.jpg';

      const result = await facebookAdapter.sendImageMessage(userId, imageUrl);

      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Sending image message')
      );
    });

    it('應該能夠發送影片訊息', async () => {
      const userId = 'test_facebook_user_123';
      const videoUrl = 'https://example.com/facebook-video.mp4';

      const result = await facebookAdapter.sendVideoMessage(userId, videoUrl);

      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Sending video message')
      );
    });

    it('應該能夠發送音訊訊息', async () => {
      const userId = 'test_facebook_user_123';
      const audioUrl = 'https://example.com/facebook-audio.mp3';

      const result = await facebookAdapter.sendAudioMessage(userId, audioUrl);

      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Sending audio message')
      );
    });

    it('應該能夠發送檔案訊息', async () => {
      const userId = 'test_facebook_user_123';
      const fileUrl = 'https://example.com/facebook-document.pdf';
      const filename = 'facebook-document.pdf';

      const result = await facebookAdapter.sendFileMessage(userId, fileUrl, filename);

      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Sending file message')
      );
    });

    it('應該在 log 中包含 app secret 和 token 資訊（遮罩）', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log');

      await facebookAdapter.sendTextMessage('user_123', 'Test message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('test_')  // app secret 前5個字符
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('test_page_')  // token 前10個字符
      );
    });
  });

  describe('createPlatformAdapter 工廠函數', () => {
    it('應該能夠創建 LINE 平台適配器', () => {
      const config = {
        channelAccessToken: 'line_token',
        channelSecret: 'line_secret'
      };

      const adapter = createPlatformAdapter('line', config);

      expect(adapter).toBeDefined();
      expect(adapter).toBeInstanceOf(LineAdapter);
    });

    it('應該能夠創建 Facebook 平台適配器', () => {
      const config = {
        appSecret: 'facebook_secret',
        pageAccessToken: 'facebook_token'
      };

      const adapter = createPlatformAdapter('facebook', config);

      expect(adapter).toBeDefined();
      expect(adapter).toBeInstanceOf(FacebookAdapter);
    });

    it('應該拒絕不支援的平台', () => {
      const config = { someConfig: 'value' };

      expect(() => {
        createPlatformAdapter('unsupported' as any, config);
      }).toThrow('Unsupported platform: unsupported');
    });

    it('返回的適配器應該實現 PlatformAdapter 接口', async () => {
      const config = {
        channelAccessToken: 'token',
        channelSecret: 'secret'
      };

      vi.spyOn(console, 'log').mockImplementation(() => {});
      const adapter = createPlatformAdapter('line', config);

      // 驗證所有必需的方法都存在
      expect(typeof adapter.sendTextMessage).toBe('function');
      expect(typeof adapter.sendImageMessage).toBe('function');
      expect(typeof adapter.sendVideoMessage).toBe('function');
      expect(typeof adapter.sendAudioMessage).toBe('function');
      expect(typeof adapter.sendFileMessage).toBe('function');

      // 測試方法是否可以被調用
      const textResult = await adapter.sendTextMessage('user', 'text');
      expect(textResult).toBe(true);
    });
  });

  describe('適配器通用行為', () => {
    it('所有適配器都應該返回 Promise<boolean>', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const lineAdapter = new LineAdapter('token', 'secret');
      const facebookAdapter = new FacebookAdapter('secret', 'token');

      // LINE adapter
      const lineTextResult = await lineAdapter.sendTextMessage('user', 'text');
      expect(typeof lineTextResult).toBe('boolean');

      // Facebook adapter
      const fbTextResult = await facebookAdapter.sendTextMessage('user', 'text');
      expect(typeof fbTextResult).toBe('boolean');
    });

    it('適配器應該處理空字串參數', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const adapter = new LineAdapter('token', 'secret');

      // 應該不會拋出錯誤
      const result = await adapter.sendTextMessage('', '');
      expect(result).toBe(true);
    });

    it('適配器應該處理特殊字符', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const adapter = new LineAdapter('token', 'secret');
      const specialText = 'Test 測試 🎉 \n\t\r';

      const result = await adapter.sendTextMessage('user', specialText);
      expect(result).toBe(true);
    });
  });

  describe('錯誤處理和邊界條件', () => {
    it('應該處理 undefined config 參數', () => {
      expect(() => {
        const adapter = new LineAdapter(undefined as any, undefined as any);
      }).not.toThrow();
    });

    it('應該處理 null config 參數', () => {
      expect(() => {
        const adapter = new FacebookAdapter(null as any, null as any);
      }).not.toThrow();
    });

    it('應該處理極長的訊息內容', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const adapter = new LineAdapter('token', 'secret');
      const longText = 'a'.repeat(10000);

      const result = await adapter.sendTextMessage('user', longText);
      expect(result).toBe(true);
    });

    it('應該處理特殊 URL 格式', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const adapter = new LineAdapter('token', 'secret');
      const specialUrls = [
        'http://example.com/file with spaces.jpg',
        'https://example.com/中文文件.pdf',
        'ftp://old-protocol.com/file.dat'
      ];

      for (const url of specialUrls) {
        const result = await adapter.sendImageMessage('user', url);
        expect(result).toBe(true);
      }
    });
  });

  describe('多平台統一接口測試', () => {
    it('LINE 和 Facebook 適配器應該有相同的方法簽名', () => {
      const lineAdapter = new LineAdapter('token', 'secret');
      const facebookAdapter = new FacebookAdapter('secret', 'token');

      const lineMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(lineAdapter));
      const facebookMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(facebookAdapter));

      // 核心方法應該在兩個適配器中都存在
      const coreMethods = [
        'sendTextMessage',
        'sendImageMessage',
        'sendVideoMessage',
        'sendAudioMessage',
        'sendFileMessage'
      ];

      coreMethods.forEach(method => {
        expect(lineMethods).toContain(method);
        expect(facebookMethods).toContain(method);
      });
    });

    it('工廠函數應該根據平台返回正確的實例', () => {
      const lineConfig = { channelAccessToken: 'line_token', channelSecret: 'line_secret' };
      const fbConfig = { appSecret: 'fb_secret', pageAccessToken: 'fb_token' };

      const lineAdapter = createPlatformAdapter('line', lineConfig);
      const fbAdapter = createPlatformAdapter('facebook', fbConfig);

      expect(lineAdapter.constructor.name).toBe('LineAdapter');
      expect(fbAdapter.constructor.name).toBe('FacebookAdapter');
    });
  });

  describe('Logger 輸出驗證', () => {
    it('LINE adapter 應該記錄所有操作', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const adapter = new LineAdapter('token', 'secret');

      await adapter.sendTextMessage('user', 'text');
      await adapter.sendImageMessage('user', 'https://example.com/image.jpg');
      await adapter.sendVideoMessage('user', 'https://example.com/video.mp4');

      expect(consoleLogSpy).toHaveBeenCalledTimes(3);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[LineAdapter]'));
    });

    it('Facebook adapter 應該記錄所有操作', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const adapter = new FacebookAdapter('secret', 'token');

      await adapter.sendTextMessage('user', 'text');
      await adapter.sendImageMessage('user', 'https://example.com/image.jpg');

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[FacebookAdapter]'));
    });
  });
});
