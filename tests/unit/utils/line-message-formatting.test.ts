import { describe, it, expect } from 'vitest';
import { createTextMessage, createStickerMessage } from '@backend/utils/line';
import type { LineReplyMessage } from '@backend/types';

describe('LINE Message Formatting Tests', () => {
  describe('createTextMessage', () => {
    describe('Basic text formatting', () => {
      it('should create simple text message', () => {
        const text = 'Hello, World!';
        const message = createTextMessage(text);

        expect(message).toEqual({
          type: 'text',
          text: 'Hello, World!'
        });
        expect(message.type).toBe('text');
        expect(message.text).toBe(text);
      });

      it('should handle empty string', () => {
        const message = createTextMessage('');
        
        expect(message).toEqual({
          type: 'text',
          text: ''
        });
      });

      it('should handle whitespace-only text', () => {
        const text = '   \n\t  ';
        const message = createTextMessage(text);
        
        expect(message).toEqual({
          type: 'text',
          text: text
        });
      });
    });

    describe('Special characters and encoding', () => {
      it('should handle Unicode characters', () => {
        const text = '你好世界！こんにちは 🌍';
        const message = createTextMessage(text);
        
        expect(message).toEqual({
          type: 'text',
          text: text
        });
      });

      it('should handle emojis', () => {
        const text = '😀😃😄😁😆😅😂🤣😊😇🙂🙃😉😌😍🥰😘😗😙😚😋😛😝😜🤪🤨🧐🤓😎🤩🥳';
        const message = createTextMessage(text);
        
        expect(message).toEqual({
          type: 'text',
          text: text
        });
      });

      it('should handle line breaks and formatting', () => {
        const text = 'Line 1\nLine 2\r\nLine 3\tTabbed\n\nDouble break';
        const message = createTextMessage(text);
        
        expect(message).toEqual({
          type: 'text',
          text: text
        });
      });

      it('should handle HTML-like content', () => {
        const text = '<div>HTML content</div>\n<script>alert("test")</script>';
        const message = createTextMessage(text);
        
        expect(message).toEqual({
          type: 'text',
          text: text
        });
      });

      it('should handle JSON-like content', () => {
        const text = '{"key": "value", "number": 123, "array": [1, 2, 3]}';
        const message = createTextMessage(text);
        
        expect(message).toEqual({
          type: 'text',
          text: text
        });
      });
    });

    describe('Length and size constraints', () => {
      it('should handle maximum length text (5000 characters)', () => {
        const text = 'a'.repeat(5000);
        const message = createTextMessage(text);
        
        expect(message).toEqual({
          type: 'text',
          text: text
        });
        expect(message.text?.length).toBe(5000);
      });

      it('should handle text exceeding LINE limit (for validation)', () => {
        const text = 'a'.repeat(5001);
        const message = createTextMessage(text);
        
        expect(message).toEqual({
          type: 'text',
          text: text
        });
        expect(message.text?.length).toBe(5001);
      });

      it('should handle single character', () => {
        const text = 'a';
        const message = createTextMessage(text);
        
        expect(message).toEqual({
          type: 'text',
          text: text
        });
      });
    });

    describe('Real-world message scenarios', () => {
      it('should handle customer service response', () => {
        const text = '感謝您的來信！\n\n我們已經收到您的問題，客服人員將在24小時內回覆您。\n\n如有緊急問題，請撥打客服專線：0800-123-456\n\n謝謝！';
        const message = createTextMessage(text);
        
        expect(message).toEqual({
          type: 'text',
          text: text
        });
      });

      it('should handle order confirmation message', () => {
        const text = '訂單確認\n━━━━━━━━━━━━━━━━\n訂單編號：#12345\n商品：iPhone 15 Pro\n數量：1\n金額：NT$ 35,900\n配送地址：台北市信義區...\n預計到貨：2024-02-15\n\n感謝您的購買！';
        const message = createTextMessage(text);
        
        expect(message).toEqual({
          type: 'text',
          text: text
        });
      });

      it('should handle URL and contact information', () => {
        const text = '更多資訊請參考：\nhttps://example.com/info\n\n聯絡方式：\n📧 support@example.com\n📞 02-1234-5678\n📱 LINE ID: @example';
        const message = createTextMessage(text);
        
        expect(message).toEqual({
          type: 'text',
          text: text
        });
      });
    });
  });

  describe('createStickerMessage', () => {
    describe('Basic sticker creation', () => {
      it('should create sticker message with string IDs', () => {
        const packageId = '1';
        const stickerId = '1';
        const message = createStickerMessage(packageId, stickerId);

        expect(message).toEqual({
          type: 'sticker',
          packageId: '1',
          stickerId: '1'
        });
      });

      it('should create sticker message with numeric string IDs', () => {
        const packageId = '11537';
        const stickerId = '52002734';
        const message = createStickerMessage(packageId, stickerId);

        expect(message).toEqual({
          type: 'sticker',
          packageId: '11537',
          stickerId: '52002734'
        });
      });
    });

    describe('LINE sticker package scenarios', () => {
      it('should handle Brown & Cony stickers', () => {
        const packageId = '11537';
        const stickerId = '52002734';
        const message = createStickerMessage(packageId, stickerId);

        expect(message.type).toBe('sticker');
        expect(message.packageId).toBe(packageId);
        expect(message.stickerId).toBe(stickerId);
      });

      it('should handle Moon stickers', () => {
        const packageId = '11538';
        const stickerId = '51626494';
        const message = createStickerMessage(packageId, stickerId);

        expect(message.type).toBe('sticker');
        expect(message.packageId).toBe(packageId);
        expect(message.stickerId).toBe(stickerId);
      });

      it('should handle basic sticker set', () => {
        const packageId = '1';
        const stickerId = '2';
        const message = createStickerMessage(packageId, stickerId);

        expect(message.type).toBe('sticker');
        expect(message.packageId).toBe(packageId);
        expect(message.stickerId).toBe(stickerId);
      });
    });

    describe('Edge cases for sticker IDs', () => {
      it('should handle zero IDs', () => {
        const packageId = '0';
        const stickerId = '0';
        const message = createStickerMessage(packageId, stickerId);

        expect(message).toEqual({
          type: 'sticker',
          packageId: '0',
          stickerId: '0'
        });
      });

      it('should handle very long numeric IDs', () => {
        const packageId = '999999999999999';
        const stickerId = '888888888888888';
        const message = createStickerMessage(packageId, stickerId);

        expect(message).toEqual({
          type: 'sticker',
          packageId: packageId,
          stickerId: stickerId
        });
      });

      it('should handle empty string IDs', () => {
        const packageId = '';
        const stickerId = '';
        const message = createStickerMessage(packageId, stickerId);

        expect(message).toEqual({
          type: 'sticker',
          packageId: '',
          stickerId: ''
        });
      });
    });
  });

  describe('Message type validation', () => {
    it('should ensure text message has correct type', () => {
      const message = createTextMessage('test');
      expect(message.type).toBe('text');
      expect(message).toHaveProperty('text');
      expect(message).not.toHaveProperty('packageId');
      expect(message).not.toHaveProperty('stickerId');
    });

    it('should ensure sticker message has correct type', () => {
      const message = createStickerMessage('1', '1');
      expect(message.type).toBe('sticker');
      expect(message).toHaveProperty('packageId');
      expect(message).toHaveProperty('stickerId');
      expect(message).not.toHaveProperty('text');
    });

    it('should create messages compatible with LINE API format', () => {
      const textMessage = createTextMessage('Hello');
      const stickerMessage = createStickerMessage('1', '1');

      // Verify they match the expected LINE API format
      expect(textMessage).toMatchObject({
        type: 'text',
        text: expect.any(String)
      });

      expect(stickerMessage).toMatchObject({
        type: 'sticker',
        packageId: expect.any(String),
        stickerId: expect.any(String)
      });
    });
  });

  describe('Message array scenarios', () => {
    it('should create multiple messages for batch sending', () => {
      const messages: LineReplyMessage[] = [
        createTextMessage('Hello!'),
        createStickerMessage('1', '1'),
        createTextMessage('How can I help you today?')
      ];

      expect(messages).toHaveLength(3);
      expect(messages[0].type).toBe('text');
      expect(messages[1].type).toBe('sticker');
      expect(messages[2].type).toBe('text');
    });

    it('should handle maximum message limit (5 messages)', () => {
      const messages: LineReplyMessage[] = [
        createTextMessage('Message 1'),
        createTextMessage('Message 2'),
        createTextMessage('Message 3'),
        createTextMessage('Message 4'),
        createTextMessage('Message 5')
      ];

      expect(messages).toHaveLength(5);
      messages.forEach((message, index) => {
        expect(message.type).toBe('text');
        expect(message.text).toBe(`Message ${index + 1}`);
      });
    });

    it('should create mixed content messages', () => {
      const messages: LineReplyMessage[] = [
        createTextMessage('Thank you for your order! 😊'),
        createStickerMessage('11537', '52002734'),
        createTextMessage('Your order will be processed within 24 hours.\n\nOrder details:\n- Product: iPhone 15\n- Quantity: 1\n- Total: $999')
      ];

      expect(messages).toHaveLength(3);
      expect(messages[0].text).toContain('😊');
      expect(messages[1].packageId).toBe('11537');
      expect(messages[2].text).toContain('Order details');
    });
  });
});