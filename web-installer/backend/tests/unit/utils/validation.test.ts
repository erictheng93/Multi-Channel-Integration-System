import { describe, it, expect } from 'vitest';
import {
  validateField,
  validateAll,
  ValidationRules
} from '@/utils/validation';

describe('Validation Utils', () => {
  describe('validateField', () => {
    it('should validate required field correctly', () => {
      const error = validateField('projectName', '', ValidationRules);

      expect(error).not.toBeNull();
      expect(error?.field).toBe('projectName');
      expect(error?.message).toContain('required');
    });

    it('should accept valid project name', () => {
      const error = validateField('projectName', 'my-crm-system', ValidationRules);

      expect(error).toBeNull();
    });

    it('should reject project name with uppercase letters', () => {
      const error = validateField('projectName', 'My-CRM-System', ValidationRules);

      expect(error).not.toBeNull();
      expect(error?.message).toContain('lowercase');
    });

    it('should reject project name with special characters', () => {
      const error = validateField('projectName', 'my@crm!system', ValidationRules);

      expect(error).not.toBeNull();
    });

    it('should reject project name that is too short', () => {
      const error = validateField('projectName', 'ab', ValidationRules);

      expect(error).not.toBeNull();
    });

    it('should accept valid email address', () => {
      const error = validateField('adminEmail', 'admin@example.com', ValidationRules);

      expect(error).toBeNull();
    });

    it('should reject invalid email address', () => {
      const error = validateField('adminEmail', 'invalid-email', ValidationRules);

      expect(error).not.toBeNull();
      expect(error?.message).toContain('valid email');
    });

    it('should accept valid custom domain', () => {
      const error = validateField('customDomain', 'crm.example.com', ValidationRules);

      expect(error).toBeNull();
    });

    it('should allow empty custom domain (optional field)', () => {
      const error = validateField('customDomain', '', ValidationRules);

      expect(error).toBeNull();
    });

    it('should reject invalid custom domain', () => {
      const error = validateField('customDomain', 'invalid domain', ValidationRules);

      expect(error).not.toBeNull();
    });
  });

  describe('validateAll', () => {
    it('should validate all fields and return all errors', () => {
      const data = {
        projectName: 'Invalid@Name',
        adminEmail: 'not-an-email',
        customDomain: 'invalid domain'
      };

      const errors = validateAll(data, ValidationRules);

      expect(errors).toHaveLength(3);
      expect(errors.some(e => e.field === 'projectName')).toBe(true);
      expect(errors.some(e => e.field === 'adminEmail')).toBe(true);
      expect(errors.some(e => e.field === 'customDomain')).toBe(true);
    });

    it('should return empty array for valid data', () => {
      const data = {
        projectName: 'my-crm-system',
        adminEmail: 'admin@example.com',
        customDomain: 'crm.example.com'
      };

      const errors = validateAll(data, ValidationRules);

      expect(errors).toHaveLength(0);
    });

    it('should handle missing optional fields', () => {
      const data = {
        projectName: 'my-crm-system',
        adminEmail: 'admin@example.com'
        // customDomain is optional and missing
      };

      const errors = validateAll(data, ValidationRules);

      expect(errors).toHaveLength(0);
    });
  });
});
