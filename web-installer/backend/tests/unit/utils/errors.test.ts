import { describe, it, expect } from 'vitest';
import {
  InstallerError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  ResourceConflictError,
  QuotaExceededError,
  CloudflareAPIError,
  mapCloudflareError
} from '@/utils/errors';

describe('Error Classes', () => {
  describe('InstallerError', () => {
    it('should create error with correct properties', () => {
      const error = new InstallerError('Test error', 500, 'TestError');

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.type).toBe('TestError');
      expect(error.name).toBe('InstallerError');
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with 400 status code', () => {
      const error = new ValidationError('Invalid input');

      expect(error.message).toBe('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.type).toBe('ValidationError');
    });
  });

  describe('AuthenticationError', () => {
    it('should create authentication error with 401 status code', () => {
      const error = new AuthenticationError('Unauthorized');

      expect(error.message).toBe('Unauthorized');
      expect(error.statusCode).toBe(401);
      expect(error.type).toBe('AuthenticationError');
    });

    it('should use default message if none provided', () => {
      const error = new AuthenticationError();

      expect(error.message).toBe('Authentication failed');
    });
  });

  describe('NotFoundError', () => {
    it('should create not found error with 404 status code', () => {
      const error = new NotFoundError('Resource not found');

      expect(error.statusCode).toBe(404);
      expect(error.type).toBe('NotFoundError');
    });
  });

  describe('ResourceConflictError', () => {
    it('should create conflict error with 409 status code', () => {
      const error = new ResourceConflictError('Already exists');

      expect(error.statusCode).toBe(409);
      expect(error.type).toBe('ResourceConflictError');
    });
  });

  describe('QuotaExceededError', () => {
    it('should create quota exceeded error with 429 status code', () => {
      const error = new QuotaExceededError('Limit reached');

      expect(error.statusCode).toBe(429);
      expect(error.type).toBe('QuotaExceededError');
    });
  });

  describe('CloudflareAPIError', () => {
    it('should create cloudflare API error', () => {
      const error = new CloudflareAPIError('API failed', 503);

      expect(error.message).toBe('API failed');
      expect(error.statusCode).toBe(503);
      expect(error.type).toBe('CloudflareAPIError');
    });
  });

  describe('mapCloudflareError', () => {
    it('should map 401 to AuthenticationError', () => {
      const cfError = { statusCode: 401, message: 'Unauthorized' };
      const error = mapCloudflareError(cfError);

      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.statusCode).toBe(401);
    });

    it('should map 403 to AuthenticationError', () => {
      const cfError = { statusCode: 403, message: 'Forbidden' };
      const error = mapCloudflareError(cfError);

      expect(error).toBeInstanceOf(AuthenticationError);
    });

    it('should map 404 to NotFoundError', () => {
      const cfError = { statusCode: 404, message: 'Not found' };
      const error = mapCloudflareError(cfError);

      expect(error).toBeInstanceOf(NotFoundError);
    });

    it('should map 409 to ResourceConflictError', () => {
      const cfError = { statusCode: 409, message: 'Conflict' };
      const error = mapCloudflareError(cfError);

      expect(error).toBeInstanceOf(ResourceConflictError);
    });

    it('should map 429 to QuotaExceededError', () => {
      const cfError = { statusCode: 429, message: 'Too many requests' };
      const error = mapCloudflareError(cfError);

      expect(error).toBeInstanceOf(QuotaExceededError);
    });

    it('should map unknown errors to CloudflareAPIError', () => {
      const cfError = { statusCode: 500, message: 'Internal error' };
      const error = mapCloudflareError(cfError);

      expect(error).toBeInstanceOf(CloudflareAPIError);
      expect(error.statusCode).toBe(500);
    });

    it('should handle errors without statusCode', () => {
      const cfError = { message: 'Unknown error' };
      const error = mapCloudflareError(cfError);

      expect(error).toBeInstanceOf(CloudflareAPIError);
      expect(error.statusCode).toBe(500);
    });
  });
});
