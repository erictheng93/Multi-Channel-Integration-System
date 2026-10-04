import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useDeploymentStore } from '../src/stores/deploymentStore';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('installer credential retrieval', () => {
  it('retries a transient credential failure after deployment completion', async () => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
    vi.stubGlobal('sessionStorage', { getItem: () => 'owner-token' });
    let attempts = 0;
    vi.stubGlobal('fetch', async (url: string) => {
      if (url.endsWith('/start')) return Response.json({ deploymentId: 'deployment' });
      if (url.endsWith('/status')) return Response.json({ deploymentId: 'deployment', status: 'completed', resources: {}, logs: [] });
      if (++attempts === 1) throw new Error('Temporary connection failure');
      return Response.json({ credentials: { username: 'admin', email: 'owner@example.com', password: 'saved-password' } });
    });
    const store = useDeploymentStore();
    await store.startDeployment({ projectName: 'owned-crm', adminEmail: 'owner@example.com', accountId: 'a'.repeat(32), oauthToken: 'owner-token' });
    await vi.advanceTimersByTimeAsync(6000);
    expect(store.credentials?.password).toBe('saved-password');
    expect(attempts).toBe(2);
    store.$dispose();
  });

  it('stops polling with a visible warning when credentials were already consumed', async () => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
    vi.stubGlobal('sessionStorage', { getItem: () => 'owner-token' });
    let attempts = 0;
    vi.stubGlobal('fetch', async (url: string) => {
      if (url.endsWith('/start')) return Response.json({ deploymentId: 'deployment' });
      if (url.endsWith('/status')) return Response.json({ deploymentId: 'deployment', status: 'completed', resources: {}, logs: [] });
      attempts++;
      return Response.json({ error: 'Credentials already retrieved' }, { status: 410 });
    });
    const store = useDeploymentStore();
    await store.startDeployment({ projectName: 'owned-crm', adminEmail: 'owner@example.com', accountId: 'a'.repeat(32), oauthToken: 'owner-token' });
    await vi.advanceTimersByTimeAsync(6000);
    expect(store.error).toContain('already retrieved');
    expect(attempts).toBe(1);
    store.$dispose();
  });
});
