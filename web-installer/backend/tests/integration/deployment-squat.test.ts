import { describe, expect, it, vi } from 'vitest';
import { DeploymentOrchestrator } from '../../src/durable-objects/DeploymentOrchestrator';

function freshObject() {
  const values = new Map<string, unknown>();
  const state = {
    storage: { get: async (k: string) => values.get(k), put: async (k: string, v: unknown) => { values.set(k, v); } },
    waitUntil: () => {},
    blockConcurrencyWhile: (cb: () => Promise<unknown>) => cb()
  } as unknown as DurableObjectState;
  return { values, object: new DeploymentOrchestrator(state, { DEPLOYMENT_ORCHESTRATOR: {} as DurableObjectNamespace, ENVIRONMENT: 'test' }) };
}
const config = (oauthToken: string) => ({ projectName: 'acme-crm', adminEmail: 'a@example.com', accountId: 'a'.repeat(32), oauthToken });
const deploy = (object: DeploymentOrchestrator, token: string) =>
  object.fetch(new Request('http://do/deploy', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(config(token)) }));

describe('installer project-name squatting', () => {
  it('does not persist an owner when Cloudflare rejects the token', async () => {
    const { object, values } = freshObject();
    const network = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ success: false }, { status: 403 }));
    try {
      expect((await deploy(object, 'JUNK-1')).status).toBe(403);
      expect(values.has('deploymentState')).toBe(false);
    } finally { network.mockRestore(); }
  });

  it('fails closed when the verification call errors', async () => {
    const { object, values } = freshObject();
    const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    try {
      expect((await deploy(object, 'JUNK-1')).status).toBe(403);
      expect(values.has('deploymentState')).toBe(false);
    } finally { network.mockRestore(); }
  });

  it('lets a verified owner claim the name after a junk attempt', async () => {
    const { object, values } = freshObject();
    const network = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const auth = new Headers(init?.headers).get('Authorization');
      const url = String(input);
      if (url.endsWith(`/accounts/${'a'.repeat(32)}`)) {
        return auth === 'Bearer VICTIM-TOK' ? Response.json({ success: true, result: {} }) : Response.json({ success: false }, { status: 403 });
      }
      throw new Error('provisioning stopped');
    });
    try {
      expect((await deploy(object, 'JUNK-1')).status).toBe(403);
      expect((await deploy(object, 'VICTIM-TOK')).status).toBe(200);
      expect((values.get('deploymentState') as { config: { oauthToken: string } }).config.oauthToken).toBe('VICTIM-TOK');
    } finally { network.mockRestore(); }
  });
});
