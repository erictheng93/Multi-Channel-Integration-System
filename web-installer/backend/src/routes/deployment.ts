/**
 * Deployment Routes
 *
 * API endpoints for managing deployments
 */

import { Hono } from 'hono';
import { validator } from 'hono/validator';
import { validateProjectName, validateEmail } from '../utils/validation';
import type { Env, StartDeploymentRequest, DeploymentConfig } from '../types';

const deployment = new Hono<{ Bindings: Env }>();

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
 * Stream deployment events via SSE
 * GET /deployment/:projectName/events
 */
deployment.get('/deployment/:projectName/events', async (c) => {
  try {
    const projectName = c.req.param('projectName');

    // Get Durable Object instance
    const doId = c.env.DEPLOYMENT_ORCHESTRATOR.idFromName(projectName);
    const doStub = c.env.DEPLOYMENT_ORCHESTRATOR.get(doId);

    // Forward SSE stream from Durable Object
    const response = await doStub.fetch('http://do/events', {
      method: 'GET'
    });

    // Return the SSE stream
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('SSE stream error:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to stream events'
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
  // In production, you'd query all Durable Objects or maintain a list in KV
  // For now, return a simple response
  return c.json({
    message: 'List endpoint not implemented',
    info: 'Each deployment is isolated in its own Durable Object'
  });
});

export default deployment;
