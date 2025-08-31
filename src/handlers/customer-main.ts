// 客戶管理處理器 - 主要實現
import { Hono } from 'hono';
import type { Bindings } from '../types';
// Removed unused drizzle imports

const customerHandler = new Hono<{ Bindings: Bindings }>();

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
    console.error('Error getting customers:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
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
    console.error('Error getting customer:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
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
    console.error('Error getting customer by platform ID:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

export default customerHandler;