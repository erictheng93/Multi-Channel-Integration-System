import { describe, expect, it } from 'vitest';
import { validateRouteOrder } from '../../../scripts/validate-route-order';

const manifest = {
  preRegistry: [
    {
      method: 'ROUTE',
      route: '/api/webhook',
      category: 'webhook',
      access: 'signature',
      reason: 'Webhook must be mounted before unified routes'
    }
  ]
};

const indexContent = `
const app = {};
registerPreRegistryRoutes(app);
const routeRegistry = new RouteRegistry(app);
`;

describe('route priority manifest validation', () => {
  it('requires every pre-registry API route to be declared', () => {
    const preRegistryContent = `
app.route('/api/webhook', webhookHandler);
app.get('/api/unlisted-public', publicHandler);
`;

    const issues = validateRouteOrder(indexContent, manifest, preRegistryContent);

    expect(issues).toContainEqual(
      expect.objectContaining({
        level: 'error',
        route: 'GET /api/unlisted-public',
        message: 'Route is not declared in preRegistry'
      })
    );
  });

  it('requires manifest entries to match the source registrations', () => {
    const preRegistryContent = '';

    const issues = validateRouteOrder(indexContent, manifest, preRegistryContent);

    expect(issues).toContainEqual(
      expect.objectContaining({
        level: 'error',
        route: 'ROUTE /api/webhook',
        message: 'preRegistry count mismatch: expected 1, found 0'
      })
    );
  });
});
