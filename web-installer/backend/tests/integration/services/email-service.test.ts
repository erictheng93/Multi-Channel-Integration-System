/**
 * EmailService - Integration Tests
 *
 * Tests email sending functionality with Resend API
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmailService } from '@/services/EmailService';
import type { AdminCredentials, CloudflareResources } from '@/types/deployment';

describe('EmailService - Integration Tests', () => {
  let emailService: EmailService;
  let fetchMock: ReturnType<typeof vi.fn>;

  const mockCredentials: AdminCredentials = {
    username: 'admin',
    password: 'temp-password-123',
    email: 'admin@example.com'
  };

  const mockResources: CloudflareResources = {
    d1DatabaseId: 'db-123',
    kvSessionNamespaceId: 'kv-456',
    kvCacheNamespaceId: 'kv-789',
    r2BucketName: 'test-uploads',
    queueName: 'delayed-messages',
    workerId: 'worker-012',
    workerUrl: 'https://test-crm.workers.dev',
    pagesProjectId: 'pages-345',
    pagesUrl: 'https://test-crm.pages.dev'
  };

  beforeEach(() => {
    emailService = new EmailService({
      apiKey: 'test-resend-api-key',
      fromEmail: 'noreply@installer.com',
      fromName: 'CRM Installer'
    });

    // Mock global fetch
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  describe('Deployment Success Email', () => {
    it('should send deployment success email', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'email-id-123',
          from: 'noreply@installer.com',
          to: ['admin@example.com'],
          created_at: new Date().toISOString()
        })
      });

      await expect(
        emailService.sendDeploymentSuccessEmail(
          'admin@example.com',
          'test-crm-system',
          mockCredentials,
          mockResources
        )
      ).resolves.not.toThrow();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-resend-api-key',
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should include all credentials in email body', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: 'email-id-123' })
      });

      await emailService.sendDeploymentSuccessEmail(
        'admin@example.com',
        'test-crm-system',
        mockCredentials,
        mockResources
      );

      const callArgs = fetchMock.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.to).toContain('admin@example.com');
      expect(body.subject).toContain('test-crm-system');
      expect(body.html).toContain('test-crm.workers.dev');
      expect(body.html).toContain('test-crm.pages.dev');
      expect(body.html).toContain('temp-password-123');
    });

    it('should format email with proper HTML structure', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: 'email-id-123' })
      });

      await emailService.sendDeploymentSuccessEmail(
        'admin@example.com',
        'test-crm',
        mockCredentials,
        mockResources
      );

      const callArgs = fetchMock.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      // Verify HTML structure
      expect(body.html).toContain('<html>');
      expect(body.html).toContain('</html>');
      expect(body.html).toContain('<body>');
      expect(body.html).toContain('</body>');

      // Verify key sections
      expect(body.html).toContain('Your CRM System is Ready');
      expect(body.html).toContain('Admin Credentials');
      expect(body.html).toContain('Application URLs');
    });

    it('should handle email delivery failure', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Invalid recipient email'
      });

      await expect(
        emailService.sendDeploymentSuccessEmail(
          'invalid@email',
          'test-crm',
          mockCredentials,
          mockResources
        )
      ).rejects.toThrow('Invalid recipient email');
    });

    it('should handle Resend API rate limiting', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded'
      });

      await expect(
        emailService.sendDeploymentSuccessEmail(
          'admin@example.com',
          'test-crm',
          mockCredentials,
          mockResources
        )
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('should handle network errors', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        emailService.sendDeploymentSuccessEmail(
          'admin@example.com',
          'test-crm',
          mockCredentials,
          mockResources
        )
      ).rejects.toThrow('Network error');
    });
  });

  describe('Deployment Failure Email', () => {
    it('should send deployment failure notification', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: 'email-id-456' })
      });

      const errorMessage = 'Database creation failed';

      await expect(
        emailService.sendDeploymentFailureEmail(
          'admin@example.com',
          'test-crm',
          errorMessage
        )
      ).resolves.not.toThrow();

      const callArgs = fetchMock.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.to).toContain('admin@example.com');
      expect(body.subject).toContain('Failed');
      expect(body.html).toContain('Database creation failed');
    });

    it('should include error details in failure email', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: 'email-id-789' })
      });

      const errorMessage = 'Migration step 15 failed: Syntax error';

      await emailService.sendDeploymentFailureEmail(
        'admin@example.com',
        'test-crm',
        errorMessage
      );

      const callArgs = fetchMock.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.html).toContain('Migration step 15 failed');
      expect(body.html).toContain('Syntax error');
    });

    it('should include support contact info in failure email', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: 'email-id-012' })
      });

      await emailService.sendDeploymentFailureEmail(
        'admin@example.com',
        'test-crm',
        'Failed'
      );

      const callArgs = fetchMock.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      // Should have contact or support information
      expect(body.html.toLowerCase()).toMatch(/support|contact|help/i);
    });
  });

  describe('Email Validation', () => {
    it('should send email with valid recipient', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: 'email-id-123' })
      });

      await expect(
        emailService.sendDeploymentSuccessEmail(
          'valid@example.com',
          'test-crm',
          mockCredentials,
          mockResources
        )
      ).resolves.not.toThrow();
    });

    it('should handle API validation errors', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Invalid email format'
      });

      await expect(
        emailService.sendDeploymentSuccessEmail(
          'invalid-email',
          'test-crm',
          mockCredentials,
          mockResources
        )
      ).rejects.toThrow('Invalid email format');
    });
  });

  describe('Authentication', () => {
    it('should include API key in all requests', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: 'email-id-123' })
      });

      await emailService.sendDeploymentSuccessEmail(
        'admin@example.com',
        'test-crm',
        mockCredentials,
        mockResources
      );

      const callArgs = fetchMock.mock.calls[0];
      const headers = callArgs[1].headers;

      expect(headers['Authorization']).toBe('Bearer test-resend-api-key');
    });

    it('should handle invalid API key', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Invalid API key'
      });

      await expect(
        emailService.sendDeploymentSuccessEmail(
          'admin@example.com',
          'test-crm',
          mockCredentials,
          mockResources
        )
      ).rejects.toThrow('Invalid API key');
    });
  });

  describe('Email Content', () => {
    it('should include project name in email', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: 'email-id-123' })
      });

      await emailService.sendDeploymentSuccessEmail(
        'admin@example.com',
        'my-awesome-crm',
        mockCredentials,
        mockResources
      );

      const callArgs = fetchMock.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.subject).toContain('my-awesome-crm');
      expect(body.html).toContain('my-awesome-crm');
    });

    it('should include both HTML and text versions', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: 'email-id-123' })
      });

      await emailService.sendDeploymentSuccessEmail(
        'admin@example.com',
        'test-crm',
        mockCredentials,
        mockResources
      );

      const callArgs = fetchMock.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.html).toBeTruthy();
      expect(body.text).toBeTruthy();
      expect(body.html.length).toBeGreaterThan(100);
      expect(body.text.length).toBeGreaterThan(50);
    });

    it('should properly format from field', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: 'email-id-123' })
      });

      await emailService.sendDeploymentSuccessEmail(
        'admin@example.com',
        'test-crm',
        mockCredentials,
        mockResources
      );

      const callArgs = fetchMock.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.from).toContain('CRM Installer');
      expect(body.from).toContain('noreply@installer.com');
    });
  });

  describe('Error Handling', () => {
    it('should throw error on non-200 response', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal server error'
      });

      await expect(
        emailService.sendDeploymentSuccessEmail(
          'admin@example.com',
          'test-crm',
          mockCredentials,
          mockResources
        )
      ).rejects.toThrow();
    });

    it('should handle network timeouts', async () => {
      fetchMock.mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      );

      await expect(
        emailService.sendDeploymentSuccessEmail(
          'admin@example.com',
          'test-crm',
          mockCredentials,
          mockResources
        )
      ).rejects.toThrow('Request timeout');
    });
  });
});
