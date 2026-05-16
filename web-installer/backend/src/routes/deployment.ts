/**
 * Deployment Routes
 *
 * API endpoints for managing deployments
 */

import { Hono } from 'hono';
import { validator } from 'hono/validator';
import { validateProjectName, validateEmail } from '../utils/validation';
import type { Env, StartDeploymentRequest, DeploymentConfig, DeploymentIndexItem, DeploymentState } from '../types';

const deployment = new Hono<{ Bindings: Env }>();

interface DeploymentIndexResponse {
  deployments?: DeploymentIndexItem[];
}

interface DeploymentSummary {
  projectName: string;
  deploymentId?: string;
  status: DeploymentState['status'] | 'unknown';
  currentStep?: DeploymentState['currentStep'];
  totalProgress?: number;
  adminEmail: string;
  accountId: string;
  customDomain?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  urls?: {
    frontend?: string;
    backend?: string;
  };
  error?: DeploymentState['error'];
}

/**
 * Health check endpoint
 * GET /health
 */
deployment.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'web-installer',
    version: '1.0.0',
    timestamp: Date.now()
  });
});

/**
 * Start a new deployment
 * POST /deployment/start
 */
deployment.post(
  '/deployment/start',
  validator('json', (value, c) => {
    const body = value as StartDeploymentRequest;

    // Validate project name
    const projectNameValidation = validateProjectName(body.projectName);
    if (!projectNameValidation.valid) {
      return c.json({ error: projectNameValidation.error }, 400);
    }

    // Validate email
    const emailValidation = validateEmail(body.adminEmail);
    if (!emailValidation.valid) {
      return c.json({ error: emailValidation.error }, 400);
    }

    // Validate account ID
    if (!body.accountId || body.accountId.length !== 32) {
      return c.json({ error: 'Invalid Cloudflare account ID' }, 400);
    }

    // Validate OAuth token
    if (!body.oauthToken) {
      return c.json({ error: 'OAuth token required' }, 400);
    }

    // Optional: validate custom domain
    if (body.customDomain) {
      const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
      if (!domainRegex.test(body.customDomain)) {
        return c.json({ error: 'Invalid custom domain format' }, 400);
      }
    }

    return body;
  }),
  async (c) => {
    try {
      const body = c.req.valid('json');

      // Get Durable Object instance
      const doId = c.env.DEPLOYMENT_ORCHESTRATOR.idFromName(body.projectName);
      const doStub = c.env.DEPLOYMENT_ORCHESTRATOR.get(doId);

      // Prepare deployment config
      const config: DeploymentConfig = {
        projectName: body.projectName,
        adminEmail: body.adminEmail,
        adminPassword: body.adminPassword,
        customDomain: body.customDomain,
        oauthToken: body.oauthToken,
        accountId: body.accountId
      };

      // Start deployment
      const response = await doStub.fetch('http://do/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      const result = await response.json();
      const resultRecord = result && typeof result === 'object' ? result as { deploymentId?: string } : {};

      const indexId = c.env.DEPLOYMENT_ORCHESTRATOR.idFromName('__deployment-index__');
      const indexStub = c.env.DEPLOYMENT_ORCHESTRATOR.get(indexId);
      await indexStub.fetch('http://do/index/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: body.projectName,
          deploymentId: resultRecord.deploymentId,
          adminEmail: body.adminEmail,
          accountId: body.accountId,
          customDomain: body.customDomain,
          createdAt: Date.now(),
          updatedAt: Date.now()
        } satisfies DeploymentIndexItem)
      });

      return c.json(result);

    } catch (error) {
      console.error('Deployment start error:', error);
      return c.json({
        error: error instanceof Error ? error.message : 'Failed to start deployment'
      }, 500);
    }
  }
);

/**
 * Get deployment status
 * GET /deployment/:projectName/status
 */
deployment.get('/deployment/:projectName/status', async (c) => {
  try {
    const projectName = c.req.param('projectName');

    // Get Durable Object instance
    const doId = c.env.DEPLOYMENT_ORCHESTRATOR.idFromName(projectName);
    const doStub = c.env.DEPLOYMENT_ORCHESTRATOR.get(doId);

    // Get status
    const response = await doStub.fetch('http://do/status', {
      method: 'GET'
    });

    if (!response.ok) {
      return c.json({ error: 'Deployment not found' }, 404);
    }

    const status = await response.json();
    return c.json(status);

  } catch (error) {
    console.error('Get status error:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to get status'
    }, 500);
  }
});

/**
 * Cancel deployment
 * POST /deployment/:projectName/cancel
 */
deployment.post('/deployment/:projectName/cancel', async (c) => {
  try {
    const projectName = c.req.param('projectName');

    // Get Durable Object instance
    const doId = c.env.DEPLOYMENT_ORCHESTRATOR.idFromName(projectName);
    const doStub = c.env.DEPLOYMENT_ORCHESTRATOR.get(doId);

    // Cancel deployment
    const response = await doStub.fetch('http://do/cancel', {
      method: 'POST'
    });

    const result = await response.json();
    return c.json(result);

  } catch (error) {
    console.error('Cancel deployment error:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to cancel deployment'
    }, 500);
  }
});

/**
 * List all deployments (for admin)
 * GET /deployments
 */
deployment.get('/deployments', async (c) => {
  try {
    const indexId = c.env.DEPLOYMENT_ORCHESTRATOR.idFromName('__deployment-index__');
    const indexStub = c.env.DEPLOYMENT_ORCHESTRATOR.get(indexId);
    const indexResponse = await indexStub.fetch('http://do/index/list', { method: 'GET' });

    if (!indexResponse.ok) {
      return c.json({ error: 'Failed to read deployment index' }, 500);
    }

    const index = await indexResponse.json<DeploymentIndexResponse>();
    const deployments = await Promise.all((index.deployments || []).map(async (item): Promise<DeploymentSummary> => {
      const doId = c.env.DEPLOYMENT_ORCHESTRATOR.idFromName(item.projectName);
      const doStub = c.env.DEPLOYMENT_ORCHESTRATOR.get(doId);
      const statusResponse = await doStub.fetch('http://do/status', { method: 'GET' });

      if (!statusResponse.ok) {
        return {
          ...item,
          status: 'unknown'
        };
      }

      const status = await statusResponse.json<Partial<DeploymentState> & { urls?: DeploymentSummary['urls'] }>();
      return {
        ...item,
        deploymentId: status.deploymentId || item.deploymentId,
        status: status.status || 'unknown',
        currentStep: status.currentStep,
        totalProgress: status.totalProgress,
        updatedAt: status.updatedAt || item.updatedAt,
        completedAt: status.completedAt,
        urls: status.urls,
        error: status.error
      };
    }));

    return c.json({
      deployments,
      count: deployments.length
    });
  } catch (error) {
    console.error('List deployments error:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to list deployments'
    }, 500);
  }
});

export default deployment;
