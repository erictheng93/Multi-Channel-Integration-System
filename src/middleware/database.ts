import { createMiddleware } from 'hono/factory';
import { createDb, KVService } from '../db';
import { DatabaseService } from '../services/database';
import { ConversationService } from '../services/conversation-service';
import type { HonoContext } from '../types/bindings';

// Database and KV initialization middleware
export const databaseMiddleware = createMiddleware<HonoContext>(async (c, next) => {
  // Initialize database connection
  const db = createDb(c.env.DB);
  
  // Initialize KV service
  const kv = new KVService(c.env.SESSIONS, c.env.CACHE);
  
  // Initialize database service
  const dbService = new DatabaseService(db, kv);
  
  // Initialize high-level services
  const conversationService = new ConversationService(dbService, kv);
  
  // Set in context variables
  c.set('db', db);
  c.set('kv', kv);
  c.set('dbService', dbService);
  c.set('conversationService', conversationService);
  
  await next();
});

// Performance monitoring middleware
export const performanceMiddleware = createMiddleware<HonoContext>(async (c, next) => {
  const start = Date.now();
  const path = c.req.path;
  
  await next();
  
  const duration = Date.now() - start;
  const kv = c.get('kv');
  
  // Log slow queries
  if (duration > 1000) {
    console.warn(`Slow request: ${path} took ${duration}ms`);
  }
  
  // Update performance metrics in KV
  const metricsKey = `metrics:${path.replace(/\//g, '_')}`;
  const currentMetrics = await kv.getCache(metricsKey) || { 
    count: 0, 
    totalTime: 0, 
    avgTime: 0,
    maxTime: 0 
  };
  
  currentMetrics.count++;
  currentMetrics.totalTime += duration;
  currentMetrics.avgTime = currentMetrics.totalTime / currentMetrics.count;
  currentMetrics.maxTime = Math.max(currentMetrics.maxTime, duration);
  
  await kv.setCache(metricsKey, currentMetrics, 3600);
});

// Authentication middleware using KV sessions
export const authMiddleware = createMiddleware<HonoContext>(async (c, next): Promise<Response | void> => {
  const authorization = c.req.header('Authorization');
  
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const token = authorization.substring(7);
  const kv = c.get('kv');
  
  try {
    // Get session from KV
    const session = await kv.getSession(token);
    
    if (!session) {
      return c.json({ error: 'Invalid or expired session' }, 401);
    }
    
    // Check if session is expired
    if (new Date(session.expiresAt) < new Date()) {
      await kv.deleteSession(token);
      return c.json({ error: 'Session expired' }, 401);
    }
    
    // Set agent info in context
    c.set('agent', {
      id: session.agentId,
      username: session.username,
      role: session.role,
      permissions: [],
      sessionId: token,
      lastActivity: new Date(),
    });
    
    await next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return c.json({ error: 'Authentication failed' }, 401);
  }
});

// Optional auth middleware (doesn't fail if no token)
export const optionalAuthMiddleware = createMiddleware<HonoContext>(async (c, next) => {
  const authorization = c.req.header('Authorization');
  
  if (authorization && authorization.startsWith('Bearer ')) {
    const token = authorization.substring(7);
    const kv = c.get('kv');
    
    try {
      const session = await kv.getSession(token);
      
      if (session && new Date(session.expiresAt) >= new Date()) {
        c.set('agent', {
          id: session.agentId,
          username: session.username,
          role: session.role,
          permissions: [],
          sessionId: token,
          lastActivity: new Date(),
        });
      }
    } catch (error) {
      console.error('Optional auth middleware error:', error);
      // Continue without authentication
    }
  }
  
  await next();
});