// 使用 Drizzle ORM 和 KV 的認證處理器
import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../services/database';
import { databaseMiddleware, authMiddleware } from '../middleware/database';
import type { HonoContext } from '../types/bindings';
import type { SessionData } from '../db/schema';

const auth = new Hono<HonoContext>();

// Apply database middleware to all routes
auth.use('*', databaseMiddleware);

// 登入
auth.post('/login', async (c) => {
  try {
    const { username, password } = await c.req.json();
    
    if (!username || !password) {
      return c.json({ 
        success: false, 
        error: 'Username and password are required' 
      }, 400);
    }

    const db = c.get('db');
    const kv = c.get('kv');
    const dbService = new DatabaseService(db, kv);

    // 查找用戶
    const agent = await dbService.getAgentByUsername(username);
    
    if (!agent || !agent.isActive) {
      return c.json({ 
        success: false, 
        error: 'Invalid credentials' 
      }, 401);
    }

    // 驗證密碼
    const isValidPassword = await bcrypt.compare(password, agent.passwordHash);
    
    if (!isValidPassword) {
      return c.json({ 
        success: false, 
        error: 'Invalid credentials' 
      }, 401);
    }

    // 生成 session token
    const sessionToken = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    const sessionData: SessionData = {
      agentId: agent.id,
      username: agent.username,
      role: agent.role,
      loginAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    // 儲存 session 到 KV
    await kv.setSession(sessionToken, sessionData, 86400); // 24 hours TTL

    // 更新最後登入時間
    await dbService.updateAgentLastLogin(agent.id);

    return c.json({
      success: true,
      data: {
        token: sessionToken,
        agent: {
          id: agent.id,
          username: agent.username,
          email: agent.email,
          displayName: agent.displayName,
          role: agent.role,
        },
        expiresAt: expiresAt.toISOString(),
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return c.json({ 
      success: false, 
      error: 'Internal server error' 
    }, 500);
  }
});

// 登出
auth.post('/logout', authMiddleware, async (c) => {
  try {
    const authorization = c.req.header('Authorization');
    const token = authorization?.substring(7); // Remove 'Bearer '
    
    if (token) {
      const kv = c.get('kv');
      await kv.deleteSession(token);
    }

    return c.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    return c.json({ 
      success: false, 
      error: 'Internal server error' 
    }, 500);
  }
});

// 獲取當前用戶資訊
auth.get('/me', authMiddleware, async (c) => {
  try {
    const agent = c.get('agent');
    const db = c.get('db');
    const kv = c.get('kv');
    const dbService = new DatabaseService(db, kv);

    // 從資料庫獲取最新的用戶資訊
    const currentAgent = await dbService.getAgentById(agent!.id);
    
    if (!currentAgent || !currentAgent.isActive) {
      return c.json({ 
        success: false, 
        error: 'Agent not found or inactive' 
      }, 404);
    }

    return c.json({
      success: true,
      data: {
        id: currentAgent.id,
        username: currentAgent.username,
        email: currentAgent.email,
        displayName: currentAgent.displayName,
        role: currentAgent.role,
        lastLoginAt: currentAgent.lastLoginAt,
        createdAt: currentAgent.createdAt,
      }
    });

  } catch (error) {
    console.error('Get me error:', error);
    return c.json({ 
      success: false, 
      error: 'Internal server error' 
    }, 500);
  }
});

// 註冊新的客服人員 (僅限管理員)
auth.post('/register', authMiddleware, async (c) => {
  try {
    const agent = c.get('agent');
    
    // 檢查權限
    if (agent!.role !== 'admin') {
      return c.json({ 
        success: false, 
        error: 'Insufficient permissions' 
      }, 403);
    }

    const { username, email, password, displayName, role = 'agent' } = await c.req.json();
    
    if (!username || !email || !password || !displayName) {
      return c.json({ 
        success: false, 
        error: 'All fields are required' 
      }, 400);
    }

    const db = c.get('db');
    const kv = c.get('kv');
    const dbService = new DatabaseService(db, kv);

    // 檢查用戶名是否已存在
    const existingAgent = await dbService.getAgentByUsername(username);
    if (existingAgent) {
      return c.json({ 
        success: false, 
        error: 'Username already exists' 
      }, 409);
    }

    // 加密密碼
    const passwordHash = await bcrypt.hash(password, 12);

    // 建立新的客服人員
    const newAgent = await dbService.createAgent({
      username,
      email,
      passwordHash,
      displayName,
      role: role as 'admin' | 'agent',
    });

    if (!newAgent) {
      return c.json({ 
        success: false, 
        error: 'Failed to create agent' 
      }, 500);
    }

    return c.json({
      success: true,
      data: {
        id: newAgent.id,
        username: newAgent.username,
        email: newAgent.email,
        displayName: newAgent.displayName,
        role: newAgent.role,
        createdAt: newAgent.createdAt,
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    return c.json({ 
      success: false, 
      error: 'Internal server error' 
    }, 500);
  }
});

export default auth;