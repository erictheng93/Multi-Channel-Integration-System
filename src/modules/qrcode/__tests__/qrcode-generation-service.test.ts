// QRCode 生成服務單元測試
// 測試 QR Code 生成相關功能

import { describe, it, expect, beforeEach } from 'vitest';
import {
  QRCodeContentProcessor,
  QRCodeGenerationEngine,
  QRCodeGenerationService
} from '../services/qrcode-generation-service';
import type { QRCodeGenerationOptions } from '@modules/qrcode/types/qrcode-types';

// ======================== QRCodeContentProcessor 測試 ========================

describe('QRCodeContentProcessor', () => {
  describe('processUrlContent', () => {
    it('should add https prefix to URL without protocol', () => {
      const result = QRCodeContentProcessor.processUrlContent('example.com');
      expect(result).toBe('https://example.com');
    });

    it('should not modify URL with https protocol', () => {
      const result = QRCodeContentProcessor.processUrlContent('https://example.com');
      expect(result).toBe('https://example.com');
    });

    it('should not modify URL with http protocol', () => {
      const result = QRCodeContentProcessor.processUrlContent('http://example.com');
      expect(result).toBe('http://example.com');
    });
  });

  describe('processContactContent', () => {
    it('should generate valid vCard format', () => {
      const contact = {
        name: 'John Doe',
        phone: '+1234567890',
        email: 'john@example.com',
        organization: 'Example Corp'
      };

      const result = QRCodeContentProcessor.processContactContent(contact);

      expect(result).toContain('BEGIN:VCARD');
      expect(result).toContain('VERSION:3.0');
      expect(result).toContain('FN:John Doe');
      expect(result).toContain('TEL:+1234567890');
      expect(result).toContain('EMAIL:john@example.com');
      expect(result).toContain('ORG:Example Corp');
      expect(result).toContain('END:VCARD');
    });

    it('should handle partial contact information', () => {
      const contact = { name: 'Jane Doe' };
      const result = QRCodeContentProcessor.processContactContent(contact);

      expect(result).toContain('FN:Jane Doe');
      expect(result).not.toContain('TEL:');
      expect(result).not.toContain('EMAIL:');
    });
  });

  describe('processWifiContent', () => {
    it('should generate valid WiFi QR code format', () => {
      const wifi = {
        ssid: 'MyNetwork',
        password: 'mypassword',
        security: 'WPA' as const,
        hidden: false
      };

      const result = QRCodeContentProcessor.processWifiContent(wifi);
      expect(result).toBe('WIFI:T:WPA;S:MyNetwork;P:mypassword;H:false;;');
    });

    it('should handle open network', () => {
      const wifi = {
        ssid: 'OpenNetwork',
        security: 'nopass' as const
      };

      const result = QRCodeContentProcessor.processWifiContent(wifi);
      expect(result).toBe('WIFI:T:nopass;S:OpenNetwork;P:;H:false;;');
    });

    it('should handle hidden network', () => {
      const wifi = {
        ssid: 'HiddenNetwork',
        password: 'secret',
        hidden: true
      };

      const result = QRCodeContentProcessor.processWifiContent(wifi);
      expect(result).toContain('H:true');
    });
  });

  describe('processSmsContent', () => {
    it('should generate SMS format with message', () => {
      const sms = {
        phone: '+1234567890',
        message: 'Hello World'
      };

      const result = QRCodeContentProcessor.processSmsContent(sms);
      expect(result).toBe('sms:+1234567890?body=Hello%20World');
    });

    it('should generate SMS format without message', () => {
      const sms = { phone: '+1234567890' };
      const result = QRCodeContentProcessor.processSmsContent(sms);
      expect(result).toBe('sms:+1234567890');
    });
  });

  describe('processEmailContent', () => {
    it('should generate email format with subject and body', () => {
      const email = {
        to: 'test@example.com',
        subject: 'Hello',
        body: 'Test message'
      };

      const result = QRCodeContentProcessor.processEmailContent(email);
      expect(result).toContain('mailto:test@example.com');
      expect(result).toContain('subject=Hello');
      expect(result).toContain('body=Test%20message');
    });

    it('should generate simple email format', () => {
      const email = { to: 'test@example.com' };
      const result = QRCodeContentProcessor.processEmailContent(email);
      expect(result).toBe('mailto:test@example.com');
    });
  });

  describe('processPhoneContent', () => {
    it('should generate phone format', () => {
      const result = QRCodeContentProcessor.processPhoneContent('+1234567890');
      expect(result).toBe('tel:+1234567890');
    });
  });

  describe('processLocationContent', () => {
    it('should generate geo format with query', () => {
      const location = {
        lat: 37.7749,
        lng: -122.4194,
        query: 'San Francisco'
      };

      const result = QRCodeContentProcessor.processLocationContent(location);
      expect(result).toBe('geo:37.7749,-122.4194?q=San%20Francisco');
    });

    it('should generate simple geo format', () => {
      const location = {
        lat: 37.7749,
        lng: -122.4194
      };

      const result = QRCodeContentProcessor.processLocationContent(location);
      expect(result).toBe('geo:37.7749,-122.4194');
    });
  });

  describe('processContent', () => {
    it('should process URL type correctly', () => {
      const result = QRCodeContentProcessor.processContent('url', 'example.com');
      expect(result).toBe('https://example.com');
    });

    it('should process text type correctly', () => {
      const result = QRCodeContentProcessor.processContent('text', 'Hello World');
      expect(result).toBe('Hello World');
    });

    it('should process contact type correctly', () => {
      const contact = { name: 'John Doe', phone: '+123456789' };
      const result = QRCodeContentProcessor.processContent('contact', contact);
      expect(result).toContain('FN:John Doe');
    });

    it('should throw error for unsupported type', () => {
      expect(() => {
        QRCodeContentProcessor.processContent('invalid' as any, 'test');
      }).toThrow('Unsupported QR code type: invalid');
    });
  });
});

// ======================== QRCodeGenerationEngine 測試 ========================

describe('QRCodeGenerationEngine', () => {
  const defaultOptions: QRCodeGenerationOptions = {
    size: 300,
    errorCorrectionLevel: 'M',
    outputFormat: 'png',
    foregroundColor: '#000000',
    backgroundColor: '#FFFFFF',
    borderWidth: 0,
    includeMargin: true
  };

  describe('generateQRCode', () => {
    it('should generate QR code with valid options', async () => {
      const content = 'Hello World';
      const result = await QRCodeGenerationEngine.generateQRCode(content, defaultOptions);

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should throw error for content too long', async () => {
      const longContent = 'A'.repeat(5000);

      await expect(
        QRCodeGenerationEngine.generateQRCode(longContent, defaultOptions)
      ).rejects.toThrow('Content too long for QR code');
    });

    it('should throw error for invalid size', async () => {
      const invalidOptions = { ...defaultOptions, size: 50 };

      await expect(
        QRCodeGenerationEngine.generateQRCode('test', invalidOptions)
      ).rejects.toThrow('QR code size must be between 100 and 2000 pixels');
    });

    it('should throw error for invalid error correction level', async () => {
      const invalidOptions = { ...defaultOptions, errorCorrectionLevel: 'X' as any };

      await expect(
        QRCodeGenerationEngine.generateQRCode('test', invalidOptions)
      ).rejects.toThrow('Invalid error correction level');
    });

    it('should throw error for invalid output format', async () => {
      const invalidOptions = { ...defaultOptions, outputFormat: 'bmp' as any };

      await expect(
        QRCodeGenerationEngine.generateQRCode('test', invalidOptions)
      ).rejects.toThrow('Invalid output format');
    });

    it('should throw error for invalid colors', async () => {
      const invalidOptions = { ...defaultOptions, foregroundColor: 'red' };

      await expect(
        QRCodeGenerationEngine.generateQRCode('test', invalidOptions)
      ).rejects.toThrow('Invalid color format');
    });
  });

  describe('different output formats', () => {
    it('should generate SVG format', async () => {
      const options = { ...defaultOptions, outputFormat: 'svg' as const };
      const result = await QRCodeGenerationEngine.generateQRCode('test', options);

      expect(result).toContain('<svg');
    });

    it('should generate base64 format', async () => {
      const options = { ...defaultOptions, outputFormat: 'base64' as const };
      const result = await QRCodeGenerationEngine.generateQRCode('test', options);

      expect(result).toMatch(/^data:image\/svg\+xml;base64,/);
    });

    it('should generate PNG format', async () => {
      const options = { ...defaultOptions, outputFormat: 'png' as const };
      const result = await QRCodeGenerationEngine.generateQRCode('test', options);

      expect(result).toMatch(/^data:image\/png;base64,/);
    });

    it('should generate JPG format', async () => {
      const options = { ...defaultOptions, outputFormat: 'jpg' as const };
      const result = await QRCodeGenerationEngine.generateQRCode('test', options);

      expect(result).toMatch(/^data:image\/jpeg;base64,/);
    });
  });

  describe('different sizes', () => {
    it('should handle minimum size', async () => {
      const options = { ...defaultOptions, size: 100 };
      const result = await QRCodeGenerationEngine.generateQRCode('test', options);

      expect(result).toBeTruthy();
    });

    it('should handle maximum size', async () => {
      const options = { ...defaultOptions, size: 2000 };
      const result = await QRCodeGenerationEngine.generateQRCode('test', options);

      expect(result).toBeTruthy();
    });
  });

  describe('different error correction levels', () => {
    it('should handle Low error correction', async () => {
      const options = { ...defaultOptions, errorCorrectionLevel: 'L' as const };
      const result = await QRCodeGenerationEngine.generateQRCode('test', options);

      expect(result).toBeTruthy();
    });

    it('should handle High error correction', async () => {
      const options = { ...defaultOptions, errorCorrectionLevel: 'H' as const };
      const result = await QRCodeGenerationEngine.generateQRCode('test', options);

      expect(result).toBeTruthy();
    });
  });
});

// ======================== QRCodeGenerationService 測試 ========================

describe('QRCodeGenerationService', () => {
  describe('generate', () => {
    it('should generate QR code with default options', async () => {
      const result = await QRCodeGenerationService.generate('text', 'Hello World');

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should generate QR code with custom options', async () => {
      const options = {
        size: 400,
        errorCorrectionLevel: 'H' as const,
        outputFormat: 'svg' as const,
        foregroundColor: '#FF0000',
        backgroundColor: '#FFFFFF'
      };

      const result = await QRCodeGenerationService.generate('text', 'Hello World', options);

      expect(result).toBeTruthy();
      expect(result).toContain('<svg');
    });

    it('should process different content types', async () => {
      const results = await Promise.all([
        QRCodeGenerationService.generate('url', 'example.com'),
        QRCodeGenerationService.generate('text', 'Hello World'),
        QRCodeGenerationService.generate('phone', '+1234567890'),
        QRCodeGenerationService.generate('email', { to: 'test@example.com' }),
        QRCodeGenerationService.generate('contact', { name: 'John Doe' })
      ]);

      results.forEach(result => {
        expect(result).toBeTruthy();
        expect(typeof result).toBe('string');
      });
    });
  });

  describe('batchGenerate', () => {
    it('should generate multiple QR codes successfully', async () => {
      const requests = [
        { type: 'text' as const, content: 'Hello 1' },
        { type: 'text' as const, content: 'Hello 2' },
        { type: 'url' as const, content: 'example.com' }
      ];

      const results = await QRCodeGenerationService.batchGenerate(requests);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.data).toBeTruthy();
        expect(result.error).toBeUndefined();
      });
    });

    it('should handle mixed success and failure', async () => {
      const requests = [
        { type: 'text' as const, content: 'Hello' },
        { type: 'invalid' as any, content: 'World' }, // Invalid type
        { type: 'text' as const, content: 'Valid' }
      ];

      const results = await QRCodeGenerationService.batchGenerate(requests);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBeTruthy();
      expect(results[2].success).toBe(true);
    });
  });

  describe('validateContent', () => {
    it('should validate text content successfully', () => {
      const result = QRCodeGenerationService.validateContent('text', 'Hello World');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate URL content successfully', () => {
      const result = QRCodeGenerationService.validateContent('url', 'https://example.com');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate invalid URL', () => {
      const result = QRCodeGenerationService.validateContent('url', 'not-a-url');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate email content successfully', () => {
      const result = QRCodeGenerationService.validateContent('email', {
        to: 'test@example.com',
        subject: 'Hello'
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate invalid email', () => {
      const result = QRCodeGenerationService.validateContent('email', {
        to: 'invalid-email'
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate phone content successfully', () => {
      const result = QRCodeGenerationService.validateContent('phone', '+1-234-567-8900');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate invalid phone number', () => {
      const result = QRCodeGenerationService.validateContent('phone', 'not-a-phone');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('estimateCapacity', () => {
    it('should return capacity estimates for different error correction levels', () => {
      const capacities = ['L', 'M', 'Q', 'H'].map(level =>
        QRCodeGenerationService.estimateCapacity(level as any)
      );

      capacities.forEach(capacity => {
        expect(Array.isArray(capacity)).toBe(true);
        expect(capacity.length).toBeGreaterThan(0);
        capacity.forEach(item => {
          expect(item).toHaveProperty('version');
          expect(item).toHaveProperty('capacity');
          expect(typeof item.version).toBe('number');
          expect(typeof item.capacity).toBe('number');
        });
      });
    });

    it('should return different capacities for different data types', () => {
      const numericCapacity = QRCodeGenerationService.estimateCapacity('M', 'numeric');
      const byteCapacity = QRCodeGenerationService.estimateCapacity('M', 'byte');

      expect(numericCapacity[0].capacity).toBeGreaterThan(byteCapacity[0].capacity);
    });

    it('should return higher capacity for lower error correction', () => {
      const lowCapacity = QRCodeGenerationService.estimateCapacity('L');
      const highCapacity = QRCodeGenerationService.estimateCapacity('H');

      expect(lowCapacity[0].capacity).toBeGreaterThan(highCapacity[0].capacity);
    });
  });
});

// ======================== 整合測試 ========================

describe('QRCodeGenerationService Integration', () => {
  it('should handle complete workflow from content to QR code', async () => {
    const originalContent = { name: 'John Doe', phone: '+1234567890' };
    const processedContent = QRCodeContentProcessor.processContent('contact', originalContent);

    expect(processedContent).toContain('FN:John Doe');

    const qrCodeData = await QRCodeGenerationService.generate('contact', originalContent);

    expect(qrCodeData).toBeTruthy();
    expect(typeof qrCodeData).toBe('string');
  });

  it('should validate and generate QR code in sequence', async () => {
    const validation = QRCodeGenerationService.validateContent('url', 'https://example.com');
    expect(validation.valid).toBe(true);

    const qrCode = await QRCodeGenerationService.generate('url', 'https://example.com');
    expect(qrCode).toBeTruthy();
  });

  it('should handle error cases gracefully', async () => {
    // Invalid content should fail validation
    const validation = QRCodeGenerationService.validateContent('email', { to: 'invalid' });
    expect(validation.valid).toBe(false);

    // But generation should handle error gracefully
    try {
      await QRCodeGenerationService.generate('email', { to: 'invalid' });
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });
});