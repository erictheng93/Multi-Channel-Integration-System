/**
 * Web Installer Worker - Main Entry Point
 *
 * Cloudflare Worker that handles the CRM self-hosted deployment system
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import oauthRoutes from './routes/oauth';
import deploymentRoutes from './routes/deployment';
import { DeploymentOrchestrator } from './durable-objects/DeploymentOrchestrator';
import type { Env } from './types';

// Create main Hono app
const app = new Hono<{ Bindings: Env }>();

// ========================================
// MIDDLEWARE
// ========================================

// Logger middleware (only in development)
app.use('*', async (c, next) => {
  if (c.env.ENVIRONMENT !== 'production') {
    return logger()(c, next);
  }
  await next();
});

// CORS middleware
app.use('*', cors({
  origin: (origin) => {
    // Allow localhost for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return origin;
    }
    // Allow Cloudflare Pages domains
    if (origin.includes('.pages.dev')) {
      return origin;
    }
    // Allow custom domains (in production, you'd have a whitelist)
    return origin;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true
}));

// ========================================
// ROUTES
// ========================================

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'CRM Web Installer',
    version: '1.0.0',
    description: 'Self-hosted deployment system for Multi-Channel CRM',
    status: 'operational',
    endpoints: {
      health: '/health',
      oauth: {
        authorize: '/oauth/authorize',
        callback: '/oauth/callback'
      },
      deployment: {
        start: '/deployment/start',
        status: '/deployment/:projectName/status',
        events: '/deployment/:projectName/events',
        cancel: '/deployment/:projectName/cancel'
      }
    },
    documentation: 'https://docs.yourcompany.com/installer',
    support: 'support@yourcompany.com'
  });
});

// Mount OAuth routes
app.route('/oauth', oauthRoutes);

// Mount deployment routes (health + deployment endpoints)
app.route('/', deploymentRoutes);

// ========================================
// ERROR HANDLING
// ========================================

// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    path: c.req.path
  }, 404);
});

// Global error handler
app.onError((err, c) => {
  console.error('Global error:', err);

  // Don't expose internal errors in production
  if (c.env.ENVIRONMENT === 'production') {
    return c.json({
      error: 'Internal Server Error',
      message: 'Something went wrong. Please try again later.'
    }, 500);
  }

  return c.json({
    error: 'Internal Server Error',
    message: err.message,
    stack: err.stack
  }, 500);
});

// ========================================
// EXPORTS
// ========================================

// Export the main Worker handler
export default {
  fetch: app.fetch
};

// Export Durable Objects
export { DeploymentOrchestrator };
