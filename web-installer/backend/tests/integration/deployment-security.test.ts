import { describe, expect, it, vi } from 'vitest';
import { DeploymentOrchestrator } from '../../src/durable-objects/DeploymentOrchestrator';
import deploymentRoutes from '../../src/routes/deployment';
import worker from '../../src/index';
import { CloudflareAPI } from '../../src/services/CloudflareAPI';
import { WorkerBundleService } from '../../src/services/WorkerBundleService';
import type { DeploymentState } from '../../src/types/deployment';
import type { Env } from '../../src/types';

function storedDeployment(projectName = 'owned-crm'): DeploymentState {
  return {
    deploymentId: 'existing-deployment',
    config: { projectName, accountId: 'a'.repeat(32), oauthToken: 'owner-token', adminEmail: 'owner@example.com' },
    status: 'completed', currentStep: 'complete', currentStepProgress: 100,
    totalProgress: 100, resources: { d1DatabaseId: 'resident-database' }, logs: [],
    adminCredentials: { username: 'admin', email: 'owner@example.com', password: 'private-password' },
    createdAt: 1, updatedAt: 2
  };
}

function coldObject(deployment = storedDeployment()) {
  const values = new Map<string, unknown>([['deploymentState', deployment]]);
  const state = {
    storage: { get: async (key: string) => values.get(key), put: async (key: string, value: unknown) => { values.set(key, value); } },
    waitUntil: () => {},
    blockConcurrencyWhile: (callback: () => Promise<unknown>) => callback()
  } as unknown as DurableObjectState;
  return { object: new DeploymentOrchestrator(state, { DEPLOYMENT_ORCHESTRATOR: {} as DurableObjectNamespace, ENVIRONMENT: 'test' }), values };
}

describe('deployment ownership', () => {
  it('configures the deployed frontend origin in Worker environment bindings', () => {
    const service = new WorkerBundleService();
    const config = { projectName: 'owned-crm', resources: {}, config: storedDeployment().config, jwtSecret: 'jwt', encryptionKey: 'encryption' };
    expect(service.generateEnvVars(config).FRONTEND_URL).toBe('https://owned-crm.pages.dev');
    expect(service.generateEnvVars({ ...config, config: { ...config.config, frontendUrl: 'https://crm.example.com', backendUrl: 'https://api.example.com' } })).toMatchObject({ FRONTEND_URL: 'https://crm.example.com', BACKEND_URL: 'https://api.example.com' });
  });
  it.each([403, 500])('fails closed when Worker existence cannot be checked: %s', async (status) => {
    const network = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('denied', { status }));
    try {
      await expect(new CloudflareAPI({ accountId: 'account', apiToken: 'token' }).workerExists('resident-worker')).rejects.toThrow();
    } finally { network.mockRestore(); }
  });

  it('recognizes an existing Worker script without trying to parse its JavaScript as JSON', async () => {
    const network = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('export default {}'));
    try {
      expect(await new CloudflareAPI({ accountId: 'account', apiToken: 'token' }).workerExists('resident-worker')).toBe(true);
    } finally { network.mockRestore(); }
  });

  it('keeps resident encryption keys when redeploying a legacy Worker', async () => {
    const deployment = storedDeployment();
    const { object } = coldObject(deployment);
    let metadata: { bindings: { name: string }[]; keep_bindings?: string[] } | undefined;
    const network = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const path = new URL(String(url)).pathname;
      if (path.endsWith('/secrets')) return Response.json({ success: true, result: [{ name: 'JWT_SECRET', type: 'secret_text' }, { name: 'ENCRYPTION_KEY', type: 'secret_text' }] });
      if (init?.method === 'PUT') {
        metadata = JSON.parse((init.body as FormData).get('metadata') as string);
        return Response.json({ success: true, result: { etag: 'worker' } });
      }
      if (path.endsWith('/workers/subdomain')) return Response.json({ success: true, result: { subdomain: 'account' } });
      if (init?.method === 'POST') return Response.json({ success: true });
      return new Response('export default {}');
    });
    try {
      const instance = object as unknown as { deploymentState: DeploymentState; api: CloudflareAPI; workerBundleService: WorkerBundleService; generatedSecrets: { jwtSecret: string; encryptionKey: string }; stepDeployWorker(): Promise<void> };
      instance.deploymentState = deployment;
      instance.api = new CloudflareAPI({ accountId: deployment.config.accountId, apiToken: 'owner-token' });
      instance.workerBundleService = new WorkerBundleService();
      instance.generatedSecrets = { jwtSecret: 'new-jwt', encryptionKey: 'new-encryption' };
      await instance.stepDeployWorker();
      expect(metadata?.keep_bindings).toEqual(['secret_text']);
      expect(metadata?.bindings.map(binding => binding.name)).not.toContain('ENCRYPTION_KEY');
      expect(metadata?.bindings.map(binding => binding.name)).not.toContain('JWT_SECRET');
    } finally { network.mockRestore(); }
  });
  it('preserves persisted runtime keys on owner redeployment without exposing them in status', async () => {
    const deployment = Object.assign(storedDeployment(), { generatedSecrets: { jwtSecret: 'existing-jwt-key', encryptionKey: 'existing-encryption-key' } });
    const { object, values } = coldObject(deployment);
    const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Provisioning unavailable'));
    try {
      await object.fetch(new Request('http://do/deploy', { method: 'POST', headers: { Authorization: 'Bearer owner-token' }, body: JSON.stringify(deployment.config) }));
      expect((values.get('deploymentState') as typeof deployment).generatedSecrets).toEqual(deployment.generatedSecrets);
      expect(await (await object.fetch(new Request('http://do/status', { headers: { Authorization: 'Bearer owner-token' } }))).text()).not.toContain('existing-encryption-key');
    } finally { network.mockRestore(); }
  });
  it('rolls back created resources while preserving reused resources', async () => {
    const deployment = storedDeployment() as DeploymentState & { reusedResources: string[] };
    deployment.status = 'in_progress';
    deployment.resources.kvSessionNamespaceId = 'new-kv';
    deployment.reusedResources = ['d1DatabaseId'];
    Object.assign(deployment, { createdResources: ['kvSessionNamespaceId'] });
    const { object } = coldObject(deployment);
    const deleted: string[] = [];
    const network = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const request = new Request(input, init);
      deleted.push(new URL(request.url).pathname);
      return Response.json({ success: true });
    });
    try {
      const response = await object.fetch(new Request('http://do/cancel', { method: 'POST', headers: { Authorization: 'Bearer owner-token' } }));
      expect(response.status).toBe(200);
      expect(deleted).toEqual([`/client/v4/accounts/${'a'.repeat(32)}/storage/kv/namespaces/new-kv`]);
    } finally {
      network.mockRestore();
    }
  });

  it('waits for in-flight creation before cancellation rollback and never provisions the next resource', async () => {
    let releaseCreation!: () => void;
    let creationStarted!: () => void;
    const started = new Promise<void>((resolve) => { creationStarted = resolve; });
    const released = new Promise<void>((resolve) => { releaseCreation = resolve; });
    const requests: string[] = [];
    let task: Promise<unknown> | undefined;
    const values = new Map<string, unknown>();
    const state = { storage: { get: async (key: string) => values.get(key), put: async (key: string, value: unknown) => { values.set(key, value); } }, waitUntil: (promise: Promise<unknown>) => { task = promise; }, blockConcurrencyWhile: (callback: () => Promise<unknown>) => callback() } as unknown as DurableObjectState;
    const object = new DeploymentOrchestrator(state, { DEPLOYMENT_ORCHESTRATOR: {} as DurableObjectNamespace, ENVIRONMENT: 'production' });
    const network = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const request = new Request(input, init);
      requests.push(`${request.method} ${new URL(request.url).pathname}`);
      if (request.method === 'POST' && request.url.endsWith('/d1/database')) {
        creationStarted();
        await released;
        return Response.json({ success: true, result: { uuid: 'new-db', name: 'owned-crm-db' } });
      }
      if (request.method === 'DELETE' && request.url.endsWith('/d1/database/new-db')) return Response.json({ success: true });
      throw new Error(`Unexpected provisioning request: ${request.method} ${request.url}`);
    });
    try {
      await object.fetch(new Request('http://do/deploy', { method: 'POST', headers: { Authorization: 'Bearer owner-token' }, body: JSON.stringify(storedDeployment().config) }));
      await started;
      const cancellation = object.fetch(new Request('http://do/cancel', { method: 'POST', headers: { Authorization: 'Bearer owner-token' } }));
      // Let authorization and persisted cancellation state finish before creation returns.
      await vi.waitFor(() => expect((values.get('deploymentState') as DeploymentState).status).toBe('rolling_back'));
      releaseCreation();
      expect((await cancellation).status).toBe(200);
      await task;
      expect(requests).toEqual([`POST /client/v4/accounts/${'a'.repeat(32)}/d1/database`, `DELETE /client/v4/accounts/${'a'.repeat(32)}/d1/database/new-db`]);
      expect((values.get('deploymentState') as DeploymentState).status).toBe('failed');
    } finally {
      releaseCreation();
      network.mockRestore();
    }
  });

  it('preserves configured runtime integrations when starting through the public route', async () => {
    let savedConfig: Record<string, unknown> | undefined;
    const namespace = { idFromName: (name: string) => name, get: (name: string) => ({ fetch: async (_url: string, init: RequestInit) => {
      if (name !== '__deployment-index__') savedConfig = JSON.parse(init.body as string);
      return Response.json({ success: true, deploymentId: 'new-deployment' });
    } }) };
    const response = await deploymentRoutes.request('/deployment/start', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner-token' }, body: JSON.stringify({ ...storedDeployment().config, lineChannelAccessToken: 'line-token', lineChannelSecret: 'line-secret', backendUrl: 'https://api.example.com' }) }, { DEPLOYMENT_ORCHESTRATOR: namespace } as unknown as Env);
    expect(response.status).toBe(200);
    expect(savedConfig).toMatchObject({ lineChannelAccessToken: 'line-token', lineChannelSecret: 'line-secret', backendUrl: 'https://api.example.com' });
  });

  it.each(['/status', '/events', '/cancel', '/deploy', '/credentials'])('rejects a foreign token at the cold DO boundary: %s', async (path) => {
    const { object, values } = coldObject();
    const response = await object.fetch(new Request(`http://do${path}`, {
      method: path === '/deploy' || path === '/cancel' || path === '/credentials' ? 'POST' : 'GET',
      headers: { Authorization: 'Bearer attacker-token', 'Content-Type': 'application/json' },
      ...(path === '/deploy' ? { body: JSON.stringify({ ...storedDeployment().config, oauthToken: 'attacker-token' }) } : {})
    }));
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain('private-password');
    expect((values.get('deploymentState') as DeploymentState).deploymentId).toBe('existing-deployment');
  });

  it('rejects missing ownership proof', async () => {
    const { object } = coldObject();
    expect((await object.fetch(new Request('http://do/status'))).status).toBe(401);
  });

  it('returns completed credentials only once to the original owner and clears persisted passwords', async () => {
    const deployment = storedDeployment();
    deployment.config.adminPassword = 'private-password';
    const { object, values } = coldObject(deployment);
    const status = await object.fetch(new Request('http://do/status', { headers: { Authorization: 'Bearer owner-token' } }));
    expect(await status.text()).not.toContain('private-password');
    const events = await object.fetch(new Request('http://do/events', { headers: { Authorization: 'Bearer owner-token' } }));
    expect(await events.text()).not.toContain('private-password');
    const denied = await object.fetch(new Request('http://do/credentials', { method: 'POST', headers: { Authorization: 'Bearer attacker-token' } }));
    expect(denied.status).toBe(403);
    const request = () => new Request('http://do/credentials', { method: 'POST', headers: { Authorization: 'Bearer owner-token' } });
    const response = await object.fetch(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ credentials: { username: 'admin', email: 'owner@example.com', password: 'private-password' } });
    expect(JSON.stringify(values.get('deploymentState'))).not.toContain('private-password');
    expect((await object.fetch(request())).status).toBe(410);
  });

  it('cannot cancel completed deployment resources even as owner', async () => {
    const { object, values } = coldObject();
    const response = await object.fetch(new Request('http://do/cancel', { method: 'POST', headers: { Authorization: 'Bearer owner-token' } }));
    expect(response.status).toBe(409);
    expect((values.get('deploymentState') as DeploymentState).status).toBe('completed');
  });

  it('forwards denial through the public status route', async () => {
    const { object } = coldObject();
    const namespace = { idFromName: (name: string) => name, get: () => ({ fetch: (url: string, init: RequestInit) => object.fetch(new Request(url, init)) }) };
    const response = await deploymentRoutes.request('/deployment/owned-crm/status', { headers: { Authorization: 'Bearer attacker-token' } }, { DEPLOYMENT_ORCHESTRATOR: namespace } as unknown as Env);
    expect(response.status).toBe(403);
  });

  it('filters ownership before calling any project object and never returns owner hashes', async () => {
    const ownerHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('owner-token'))), byte => byte.toString(16).padStart(2, '0')).join('');
    const index = [{ projectName: 'owned-crm', ownerTokenHash: ownerHash, adminEmail: 'owner@example.com', accountId: 'a'.repeat(32), createdAt: 1, updatedAt: 2 }, { projectName: 'foreign-crm', ownerTokenHash: 'foreign-hash', adminEmail: 'victim@example.com', accountId: 'b'.repeat(32), createdAt: 1, updatedAt: 2 }, { projectName: 'legacy', adminEmail: 'legacy@example.com', accountId: 'b'.repeat(32), createdAt: 1, updatedAt: 2 }];
    const statusCalls: string[] = [];
    const owned = coldObject().object;
    const foreignState = storedDeployment('foreign-crm');
    foreignState.config.oauthToken = 'foreign-token';
    const foreign = coldObject(foreignState).object;
    const namespace = { idFromName: (name: string) => name, get: (name: string) => ({ fetch: (url: string, init: RequestInit) => { if (name === '__deployment-index__') return Promise.resolve(Response.json({ deployments: index })); statusCalls.push(name); return (name === 'owned-crm' ? owned : foreign).fetch(new Request(url, init)); } }) };
    const denied = await deploymentRoutes.request('/deployments', { headers: { Authorization: 'Bearer attacker-token' } }, { DEPLOYMENT_ORCHESTRATOR: namespace } as unknown as Env);
    expect(await denied.json()).toMatchObject({ deployments: [], count: 0 });
    expect(statusCalls).toEqual([]);
    const response = await deploymentRoutes.request('/deployments', { headers: { Authorization: 'Bearer owner-token' } }, { DEPLOYMENT_ORCHESTRATOR: namespace } as unknown as Env);
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('owned-crm');
    expect(text).not.toContain('foreign-crm');
    expect(text).not.toContain('victim@example.com');
    expect(text).not.toContain('ownerTokenHash');
    expect(text).not.toContain(ownerHash);
    expect(statusCalls).toEqual(['owned-crm']);
  });

  it('bounds list status calls to the requested owner page', async () => {
    const ownerTokenHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('owner-token'))), byte => byte.toString(16).padStart(2, '0')).join('');
    const index = Array.from({ length: 75 }, (_, number) => ({ projectName: `project-${number}`, ownerTokenHash, adminEmail: 'owner@example.com', accountId: 'a'.repeat(32), createdAt: 1, updatedAt: 2 }));
    const calls: string[] = [];
    const namespace = { idFromName: (name: string) => name, get: (name: string) => ({ fetch: async () => { if (name === '__deployment-index__') return Response.json({ deployments: index }); calls.push(name); return Response.json({ status: 'completed' }); } }) };
    const env = { DEPLOYMENT_ORCHESTRATOR: namespace } as unknown as Env;
    expect((await deploymentRoutes.request('/deployments?limit=999&offset=5', { headers: { Authorization: 'Bearer owner-token' } }, env)).status).toBe(200);
    expect(calls).toHaveLength(50);
    expect(calls[0]).toBe('project-5');
    calls.length = 0;
    await deploymentRoutes.request('/deployments', { headers: { Authorization: 'Bearer owner-token' } }, env);
    expect(calls).toHaveLength(20);
    calls.length = 0;
    expect((await deploymentRoutes.request('/deployments?offset=-1', { headers: { Authorization: 'Bearer owner-token' } }, env)).status).toBe(400);
    expect(calls).toEqual([]);
  });

  it('preserves legacy resources with no creation provenance during cancellation', async () => {
    const deployment = storedDeployment();
    deployment.status = 'in_progress';
    const { object } = coldObject(deployment);
    const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Legacy resource must not be deleted'));
    try {
      expect((await object.fetch(new Request('http://do/cancel', { method: 'POST', headers: { Authorization: 'Bearer owner-token' } }))).status).toBe(200);
      expect(network).not.toHaveBeenCalled();
    } finally { network.mockRestore(); }
  });

  it('does not reflect arbitrary origins in production', async () => {
    const response = await worker.fetch(new Request('http://installer/health', { headers: { Origin: 'https://attacker.pages.dev' } }), { ENVIRONMENT: 'production', ALLOWED_ORIGINS: 'https://installer.example.com' } as unknown as Env);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});
