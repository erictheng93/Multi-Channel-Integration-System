// 客戶管理處理器 - 主要實現
import { Hono } from 'hono';
import type { Bindings } from '../types';
import { handleApiError } from '../utils/api-response';

const customerHandler = new Hono<{ Bindings: Bindings }>();

// 🔥 CORS Middleware - Add CORS headers to ALL responses
customerHandler.use('*', async (c, next) => {
  const origin = c.req.header('Origin') || '';
  const allowedOrigins = [
    'https://multi-channel.imfinethankyouandyou.com',
    'http://localhost:3000',
    'https://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8787',
  ];

  // Check if origin matches Cloudflare Pages preview domains
  const isPagesPreview = origin.endsWith('.multi-channel-platform-frontend.pages.dev');

  await next();

  // Add CORS headers to response
  if ((allowedOrigins.includes(origin) || isPagesPreview) && origin) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Credentials', 'true');
  }
});

// 🔥 CORS Preflight Handler - Handle OPTIONS requests
customerHandler.options('*', (c) => {
  const origin = c.req.header('Origin') || '';
  const allowedOrigins = [
    'https://multi-channel.imfinethankyouandyou.com',
    'http://localhost:3000',
    'https://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8787',
  ];

  // Check if origin matches Cloudflare Pages preview domains
  const isPagesPreview = origin.endsWith('.multi-channel-platform-frontend.pages.dev');

  const response = new Response(null, { status: 204 });

  // Add CORS headers if origin is allowed
  if ((allowedOrigins.includes(origin) || isPagesPreview) && origin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  response.headers.set('Access-Control-Max-Age', '86400');

  // Prevent Cloudflare edge caching of OPTIONS responses
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');

  return response;
});

// 客戶資訊查詢端點
customerHandler.get('/', async (c) => {
  try {
    const { getAllCustomers } = await import('../utils/database');
    const customers = await getAllCustomers(c.env.DB);
    
    return c.json({
      success: true,
      data: {
        customers,
        count: customers.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Operation failed:', error);
    return handleApiError(error, c);
  }
});

// 特定客戶資訊查詢端點
customerHandler.get('/:customerId', async (c) => {
  try {
    const customerId = parseInt(c.req.param('customerId'));
    const { getCustomerById, getCustomerConversations } = await import('../utils/database');
    
    const customer = await getCustomerById(c.env.DB, customerId);
    if (!customer) {
      return c.json({
        success: false,
        error: 'Customer not found',
        timestamp: new Date().toISOString()
      }, 404);
    }
    
    const conversations = await getCustomerConversations(c.env.DB, customerId);
    
    return c.json({
      success: true,
      data: {
        customer,
        conversations,
        conversationCount: conversations.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Operation failed:', error);
    return handleApiError(error, c);
  }
});

// 根據平台用戶ID查詢客戶
customerHandler.get('/platform/:platform/:platformUserId', async (c) => {
  try {
    const platform = c.req.param('platform');
    const platformUserId = c.req.param('platformUserId');
    const { getCustomerByPlatformId, getCustomerConversations } = await import('../utils/database');
    
    const customer = await getCustomerByPlatformId(c.env.DB, platform, platformUserId);
    if (!customer) {
      return c.json({
        success: false,
        error: 'Customer not found',
        timestamp: new Date().toISOString()
      }, 404);
    }
    
    const conversations = await getCustomerConversations(c.env.DB, customer.id);
    
    return c.json({
      success: true,
      data: {
        customer,
        conversations,
        conversationCount: conversations.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Operation failed:', error);
    return handleApiError(error, c);
  }
});

export default customerHandler;