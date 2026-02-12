// Unit Tests for Platform Message Parser Service
// 測試平台訊息解析服務

import { describe, it, expect } from 'vitest';
import {
  parseLineMessage,
  parseFacebookMessage,
  parseMessage,
  mapLineMessageType,
  mapFacebookMessageType,
  hasDownloadableMedia,
  getDisplayContent
} from '@/services/platform-message-parser';

describe('platform-message-parser', () => {
  describe('parseLineMessage', () => {
    it('should parse text message', () => {
      const message = { type: 'text', text: 'Hello World' };
      const result = parseLineMessage(message);

      expect(result.content).toBe('Hello World');
      expect(result.type).toBe('text');
      expect(result.platform).toBe('line');
      expect(result.mediaData).toBeNull();
    });

    it('should parse image message', () => {
      const message = {
        type: 'image',
        id: 'img123',
        contentProvider: { type: 'line' }
      };
      const result = parseLineMessage(message);

      expect(result.content).toBe('[圖片]');
      expect(result.type).toBe('image');
      expect(result.mediaData).not.toBeNull();
      expect(result.mediaData?.id).toBe('img123');
    });

    it('should parse video message', () => {
      const message = {
        type: 'video',
        id: 'vid123',
        duration: 30000,
        contentProvider: { type: 'line' }
      };
      const result = parseLineMessage(message);

      expect(result.content).toBe('[影片]');
      expect(result.type).toBe('video');
      expect(result.mediaData?.duration).toBe(30000);
    });

    it('should parse audio message', () => {
      const message = {
        type: 'audio',
        id: 'aud123',
        duration: 5000
      };
      const result = parseLineMessage(message);

      expect(result.content).toBe('[語音]');
      expect(result.type).toBe('audio');
    });

    it('should parse file message', () => {
      const message = {
        type: 'file',
        id: 'file123',
        fileName: 'document.pdf',
        fileSize: 1024
      };
      const result = parseLineMessage(message);

      expect(result.content).toBe('[檔案] document.pdf');
      expect(result.type).toBe('file');
      expect(result.mediaData?.fileName).toBe('document.pdf');
    });

    it('should parse location message', () => {
      const message = {
        type: 'location',
        title: 'Taipei 101',
        address: '110台北市信義區信義路五段7號',
        latitude: 25.0339,
        longitude: 121.5619
      };
      const result = parseLineMessage(message);

      expect(result.content).toContain('[位置]');
      expect(result.content).toContain('Taipei 101');
      expect(result.type).toBe('location');
      expect(result.metadata.location).toBeDefined();
    });

    it('should parse sticker message', () => {
      const message = {
        type: 'sticker',
        packageId: '1',
        stickerId: '1'
      };
      const result = parseLineMessage(message);

      expect(result.content).toBe('[貼圖]');
      expect(result.type).toBe('sticker');
      expect(result.metadata.sticker).toBeDefined();
    });

    it('should handle unsupported message type', () => {
      const message = { type: 'unknown_type' };
      const result = parseLineMessage(message);

      expect(result.content).toContain('未支援');
      expect(result.type).toBe('text');
      expect(result.metadata.originalType).toBe('unknown_type');
    });

    it('should handle null message', () => {
      const result = parseLineMessage(null);
      expect(result.content).toBe('');
      expect(result.type).toBe('text');
    });
  });

  describe('parseFacebookMessage', () => {
    it('should parse text message', () => {
      const message = { text: 'Hello from Facebook' };
      const result = parseFacebookMessage(message);

      expect(result.content).toBe('Hello from Facebook');
      expect(result.type).toBe('text');
      expect(result.platform).toBe('facebook');
    });

    it('should parse image attachment', () => {
      const message = {
        attachments: [
          {
            type: 'image',
            payload: { url: 'https://example.com/image.jpg' }
          }
        ]
      };
      const result = parseFacebookMessage(message);

      expect(result.content).toBe('[圖片]');
      expect(result.type).toBe('image');
      expect(result.mediaData?.contentProvider?.originalContentUrl).toBe('https://example.com/image.jpg');
    });

    it('should parse video attachment', () => {
      const message = {
        attachments: [
          {
            type: 'video',
            payload: { url: 'https://example.com/video.mp4' }
          }
        ]
      };
      const result = parseFacebookMessage(message);

      expect(result.content).toBe('[影片]');
      expect(result.type).toBe('video');
    });

    it('should parse location attachment', () => {
      const message = {
        attachments: [
          {
            type: 'location',
            payload: {
              coordinates: { lat: 25.0339, long: 121.5619 }
            }
          }
        ]
      };
      const result = parseFacebookMessage(message);

      expect(result.content).toContain('[位置]');
      expect(result.type).toBe('location');
      expect(result.metadata.location).toBeDefined();
    });

    it('should handle quick reply', () => {
      const message = {
        text: 'Yes',
        quick_reply: { payload: 'CONFIRM_YES' }
      };
      const result = parseFacebookMessage(message);

      expect(result.content).toBe('Yes');
      expect(result.metadata.quickReply).toBeDefined();
    });

    it('should handle null message', () => {
      const result = parseFacebookMessage(null);
      expect(result.content).toBe('');
      expect(result.type).toBe('text');
    });
  });

  describe('parseMessage (unified parser)', () => {
    it('should route LINE messages correctly', () => {
      const message = { type: 'text', text: 'Hello' };
      const result = parseMessage('line', message);

      expect(result.platform).toBe('line');
      expect(result.content).toBe('Hello');
    });

    it('should route Facebook messages correctly', () => {
      const message = { text: 'Hello' };
      const result = parseMessage('facebook', message);

      expect(result.platform).toBe('facebook');
      expect(result.content).toBe('Hello');
    });

    it('should route Instagram messages correctly', () => {
      const message = { text: 'Hello' };
      const result = parseMessage('instagram', message);

      // Instagram falls through to parseFacebookMessage which returns 'facebook' platform
      expect(result.platform).toBe('facebook');
      expect(result.content).toBe('Hello');
    });
  });

  describe('mapLineMessageType', () => {
    it('should map known types correctly', () => {
      expect(mapLineMessageType('text')).toBe('text');
      expect(mapLineMessageType('image')).toBe('image');
      expect(mapLineMessageType('video')).toBe('video');
      expect(mapLineMessageType('audio')).toBe('audio');
      expect(mapLineMessageType('file')).toBe('file');
      expect(mapLineMessageType('location')).toBe('location');
      expect(mapLineMessageType('sticker')).toBe('sticker');
    });

    it('should default unknown types to text', () => {
      expect(mapLineMessageType('unknown')).toBe('text');
    });
  });

  describe('mapFacebookMessageType', () => {
    it('should map known types correctly', () => {
      expect(mapFacebookMessageType('image')).toBe('image');
      expect(mapFacebookMessageType('video')).toBe('video');
      expect(mapFacebookMessageType('audio')).toBe('audio');
      expect(mapFacebookMessageType('file')).toBe('file');
      expect(mapFacebookMessageType('location')).toBe('location');
      expect(mapFacebookMessageType('fallback')).toBe('text');
    });

    it('should default unknown types to text', () => {
      expect(mapFacebookMessageType('unknown')).toBe('text');
    });
  });

  describe('hasDownloadableMedia', () => {
    it('should return true for image message', () => {
      const parsed = parseLineMessage({ type: 'image', id: '123' });
      expect(hasDownloadableMedia(parsed)).toBe(true);
    });

    it('should return true for video message', () => {
      const parsed = parseLineMessage({ type: 'video', id: '123' });
      expect(hasDownloadableMedia(parsed)).toBe(true);
    });

    it('should return false for text message', () => {
      const parsed = parseLineMessage({ type: 'text', text: 'Hello' });
      expect(hasDownloadableMedia(parsed)).toBe(false);
    });

    it('should return false for location message', () => {
      const parsed = parseLineMessage({
        type: 'location',
        latitude: 0,
        longitude: 0
      });
      expect(hasDownloadableMedia(parsed)).toBe(false);
    });

    it('should return false for sticker message', () => {
      const parsed = parseLineMessage({
        type: 'sticker',
        packageId: '1',
        stickerId: '1'
      });
      expect(hasDownloadableMedia(parsed)).toBe(false);
    });
  });

  describe('getDisplayContent', () => {
    it('should return content from parsed message', () => {
      const parsed = parseLineMessage({ type: 'text', text: 'Hello World' });
      expect(getDisplayContent(parsed)).toBe('Hello World');
    });

    it('should return placeholder for media messages', () => {
      const parsed = parseLineMessage({ type: 'image', id: '123' });
      expect(getDisplayContent(parsed)).toBe('[圖片]');
    });
  });
});
