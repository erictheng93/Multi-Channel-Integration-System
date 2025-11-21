// IP Validator Unit Tests
// Tests for IP whitelist validation against official platform IP ranges

import { describe, it, expect } from 'vitest';
import { IPValidator, LINE_IP_RANGES, FACEBOOK_IP_RANGES, createIPValidator } from '@/utils/ip-validator';

describe('IPValidator', () => {
  describe('LINE IP Ranges', () => {
    const validator = new IPValidator(LINE_IP_RANGES);

    it('should allow LINE official IP range 147.92.128.0/17', () => {
      // Test IPs within 147.92.128.0 to 147.92.255.255
      expect(validator.isAllowed('147.92.128.1', 'line')).toBe(true);
      expect(validator.isAllowed('147.92.150.100', 'line')).toBe(true);
      expect(validator.isAllowed('147.92.255.254', 'line')).toBe(true);
    });

    it('should allow LINE backup IP range 203.104.128.0/17', () => {
      // Test IPs within 203.104.128.0 to 203.104.255.255
      expect(validator.isAllowed('203.104.128.1', 'line')).toBe(true);
      expect(validator.isAllowed('203.104.200.50', 'line')).toBe(true);
      expect(validator.isAllowed('203.104.255.254', 'line')).toBe(true);
    });

    it('should reject IPs outside LINE ranges', () => {
      expect(validator.isAllowed('1.2.3.4', 'line')).toBe(false);
      expect(validator.isAllowed('147.92.127.255', 'line')).toBe(false); // Just before range
      expect(validator.isAllowed('147.93.0.1', 'line')).toBe(false); // Just after range
      expect(validator.isAllowed('8.8.8.8', 'line')).toBe(false);
      expect(validator.isAllowed('192.168.1.1', 'line')).toBe(false);
    });

    it('should reject invalid IP formats', () => {
      expect(validator.isAllowed('invalid-ip', 'line')).toBe(false);
      expect(validator.isAllowed('999.999.999.999', 'line')).toBe(false);
      expect(validator.isAllowed('', 'line')).toBe(false);
    });
  });

  describe('Facebook IP Ranges', () => {
    const validator = new IPValidator(FACEBOOK_IP_RANGES);

    it('should allow Facebook official IPs from various ranges', () => {
      // Test a few IPs from different Facebook CIDR blocks
      expect(validator.isAllowed('31.13.24.1', 'facebook')).toBe(true);      // 31.13.24.0/21
      expect(validator.isAllowed('69.63.176.100', 'facebook')).toBe(true);   // 69.63.176.0/20
      expect(validator.isAllowed('157.240.0.1', 'facebook')).toBe(true);     // 157.240.0.0/17
      expect(validator.isAllowed('173.252.64.50', 'facebook')).toBe(true);   // 173.252.64.0/18
    });

    it('should reject IPs outside Facebook ranges', () => {
      expect(validator.isAllowed('1.2.3.4', 'facebook')).toBe(false);
      expect(validator.isAllowed('8.8.8.8', 'facebook')).toBe(false);
      expect(validator.isAllowed('192.168.1.1', 'facebook')).toBe(false);
    });

    it('should work with Instagram platform (uses Facebook IPs)', () => {
      expect(validator.isAllowed('31.13.24.1', 'instagram')).toBe(false); // Will fail because platform filter
    });
  });

  describe('Combined Platform Validator', () => {
    const validator = createIPValidator();

    it('should handle both LINE and Facebook platforms', () => {
      // LINE IPs
      expect(validator.isAllowed('147.92.150.1', 'line')).toBe(true);
      expect(validator.isAllowed('203.104.200.50', 'line')).toBe(true);

      // Facebook IPs
      expect(validator.isAllowed('31.13.24.1', 'facebook')).toBe(true);
      expect(validator.isAllowed('157.240.0.1', 'facebook')).toBe(true);
    });

    it('should reject cross-platform IPs', () => {
      // LINE IP should not be valid for Facebook
      expect(validator.isAllowed('147.92.150.1', 'facebook')).toBe(false);

      // Facebook IP should not be valid for LINE
      expect(validator.isAllowed('31.13.24.1', 'line')).toBe(false);
    });

    it('should count total ranges correctly', () => {
      expect(validator.getTotalRanges()).toBe(LINE_IP_RANGES.length + FACEBOOK_IP_RANGES.length);
      expect(validator.getTotalRanges()).toBe(14); // 2 LINE + 12 Facebook
    });

    it('should get ranges for specific platforms', () => {
      expect(validator.getRangesForPlatform('line').length).toBe(2);
      expect(validator.getRangesForPlatform('facebook').length).toBe(12);
      expect(validator.getRangesForPlatform('whatsapp').length).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    const validator = createIPValidator();

    it('should handle IPv6 addresses gracefully', () => {
      // Currently our ranges are IPv4 only, so IPv6 should be rejected
      expect(validator.isAllowed('2001:db8::1', 'line')).toBe(false);
      expect(validator.isAllowed('::1', 'facebook')).toBe(false);
    });

    it('should handle boundary IPs correctly', () => {
      // Test first and last IP of a range
      expect(validator.isAllowed('147.92.128.0', 'line')).toBe(true);   // First IP
      expect(validator.isAllowed('147.92.255.255', 'line')).toBe(true); // Last IP
    });

    it('should reject IPs just outside range boundaries', () => {
      expect(validator.isAllowed('147.92.127.255', 'line')).toBe(false); // One before
      expect(validator.isAllowed('147.93.0.0', 'line')).toBe(false);     // One after
    });
  });

  describe('Platform Configuration', () => {
    it('should have correct LINE IP ranges', () => {
      expect(LINE_IP_RANGES).toHaveLength(2);
      expect(LINE_IP_RANGES[0].cidr).toBe('147.92.128.0/17');
      expect(LINE_IP_RANGES[1].cidr).toBe('203.104.128.0/17');
    });

    it('should have correct Facebook IP ranges', () => {
      expect(FACEBOOK_IP_RANGES).toHaveLength(12);
      expect(FACEBOOK_IP_RANGES).toContainEqual({ cidr: '31.13.24.0/21', platform: 'facebook' });
      expect(FACEBOOK_IP_RANGES).toContainEqual({ cidr: '157.240.0.0/17', platform: 'facebook' });
    });

    it('should not have duplicate ranges', () => {
      const allRanges = [...LINE_IP_RANGES, ...FACEBOOK_IP_RANGES];
      const cidrSet = new Set(allRanges.map(r => r.cidr));
      expect(cidrSet.size).toBe(allRanges.length);
    });
  });
});
