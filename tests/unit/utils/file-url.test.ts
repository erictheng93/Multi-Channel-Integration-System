import { describe, it, expect } from 'vitest';
import { getPublicFileUrl, isPublicDomainConfigured, getSignedDownloadUrl } from '@/utils/file-url';
import type { Bindings } from '@/types';

// Minimal mock env factory
function mockEnv(overrides: Partial<Bindings> = {}): Bindings {
  return {
    STORAGE_PUBLIC_URL: undefined,
    R2_CUSTOM_DOMAIN: undefined,
    R2_PUBLIC_DOMAIN: undefined,
    BACKEND_URL: 'https://mcis-backend.daiwandist.com',
    ...overrides,
  } as unknown as Bindings;
}

describe('getPublicFileUrl', () => {
  const r2Key = 'media/line/2026/3/abc123.jpg';

  it('uses STORAGE_PUBLIC_URL when available (priority 1)', () => {
    const env = mockEnv({ STORAGE_PUBLIC_URL: 'https://s3.daiwandist.com' });
    expect(getPublicFileUrl(env, r2Key)).toBe(
      'https://s3.daiwandist.com/media/line/2026/3/abc123.jpg'
    );
  });

  it('strips trailing slash from STORAGE_PUBLIC_URL', () => {
    const env = mockEnv({ STORAGE_PUBLIC_URL: 'https://s3.daiwandist.com/' });
    expect(getPublicFileUrl(env, r2Key)).toBe(
      'https://s3.daiwandist.com/media/line/2026/3/abc123.jpg'
    );
  });

  it('uses R2_CUSTOM_DOMAIN when STORAGE_PUBLIC_URL is not set (priority 2)', () => {
    const env = mockEnv({ R2_CUSTOM_DOMAIN: 'cdn.example.com' });
    expect(getPublicFileUrl(env, r2Key)).toBe(
      'https://cdn.example.com/media/line/2026/3/abc123.jpg'
    );
  });

  it('uses R2_PUBLIC_DOMAIN when higher-priority vars are not set (priority 3)', () => {
    const env = mockEnv({ R2_PUBLIC_DOMAIN: 'r2pub.example.com' });
    expect(getPublicFileUrl(env, r2Key)).toBe(
      'https://r2pub.example.com/media/line/2026/3/abc123.jpg'
    );
  });

  it('falls back to Worker proxy when no public domain is configured (priority 4)', () => {
    const env = mockEnv({});
    expect(getPublicFileUrl(env, r2Key)).toBe(
      'https://mcis-backend.daiwandist.com/api/files/public/media/line/2026/3/abc123.jpg'
    );
  });

  it('falls back to Worker proxy using getBackendUrl when BACKEND_URL is also missing', () => {
    const env = mockEnv({ BACKEND_URL: undefined });
    const url = getPublicFileUrl(env, r2Key);
    expect(url).toContain('/api/files/public/');
    expect(url).toContain(r2Key);
  });

  it('handles r2Key with leading slash', () => {
    const env = mockEnv({ STORAGE_PUBLIC_URL: 'https://s3.daiwandist.com' });
    expect(getPublicFileUrl(env, '/media/line/2026/3/abc123.jpg')).toBe(
      'https://s3.daiwandist.com/media/line/2026/3/abc123.jpg'
    );
  });

  it('STORAGE_PUBLIC_URL takes priority over R2_CUSTOM_DOMAIN', () => {
    const env = mockEnv({
      STORAGE_PUBLIC_URL: 'https://s3.daiwandist.com',
      R2_CUSTOM_DOMAIN: 'cdn.example.com',
    });
    expect(getPublicFileUrl(env, r2Key)).toBe(
      'https://s3.daiwandist.com/media/line/2026/3/abc123.jpg'
    );
  });

  it('handles local dev STORAGE_PUBLIC_URL (localhost)', () => {
    const env = mockEnv({ STORAGE_PUBLIC_URL: 'http://localhost:8787/files' });
    expect(getPublicFileUrl(env, r2Key)).toBe(
      'http://localhost:8787/files/media/line/2026/3/abc123.jpg'
    );
  });
});

describe('getSignedDownloadUrl', () => {
  const attachmentId = 'att-205a05ca-1870';
  const r2Key = 'media/line/2026/3/abc123.jpg';

  it('points at the force-download proxy route with the attachment id', async () => {
    const env = mockEnv({ JWT_SECRET: 'test-secret' });
    const url = await getSignedDownloadUrl(env, attachmentId, r2Key);
    expect(url.startsWith(
      `https://mcis-backend.daiwandist.com/api/files/download/${attachmentId}?`
    )).toBe(true);
  });

  it('attaches sig and exp query params', async () => {
    const env = mockEnv({ JWT_SECRET: 'test-secret' });
    const url = new URL(await getSignedDownloadUrl(env, attachmentId, r2Key));
    expect(url.searchParams.get('sig')).toBeTruthy();
    expect(Number(url.searchParams.get('exp'))).toBeGreaterThan(0);
  });

  it('url-encodes the attachment id in the path', async () => {
    const env = mockEnv({ JWT_SECRET: 'test-secret' });
    const url = await getSignedDownloadUrl(env, 'a/b c', r2Key);
    expect(url).toContain('/api/files/download/a%2Fb%20c?');
  });
});

describe('isPublicDomainConfigured', () => {
  it('returns true when STORAGE_PUBLIC_URL is set', () => {
    const env = mockEnv({ STORAGE_PUBLIC_URL: 'https://s3.daiwandist.com' });
    expect(isPublicDomainConfigured(env)).toBe(true);
  });

  it('returns true when R2_CUSTOM_DOMAIN is set', () => {
    const env = mockEnv({ R2_CUSTOM_DOMAIN: 'cdn.example.com' });
    expect(isPublicDomainConfigured(env)).toBe(true);
  });

  it('returns false when no public domain vars are set', () => {
    const env = mockEnv({});
    expect(isPublicDomainConfigured(env)).toBe(false);
  });

  it('returns false for localhost URLs (dev environment)', () => {
    const env = mockEnv({ STORAGE_PUBLIC_URL: 'http://localhost:8787/files' });
    expect(isPublicDomainConfigured(env)).toBe(false);
  });

  it('returns false when R2_CUSTOM_DOMAIN is localhost', () => {
    const env = mockEnv({ R2_CUSTOM_DOMAIN: 'localhost:8787' });
    expect(isPublicDomainConfigured(env)).toBe(false);
  });

  it('returns true when R2_PUBLIC_DOMAIN is a real domain', () => {
    const env = mockEnv({ R2_PUBLIC_DOMAIN: 'r2pub.example.com' });
    expect(isPublicDomainConfigured(env)).toBe(true);
  });
});
