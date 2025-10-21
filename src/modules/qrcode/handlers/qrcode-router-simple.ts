// 簡化版 QRCode 路由器
import { Hono } from 'hono';
import type { Bindings } from '@/types';
import { qrCodeSimpleHandler } from '@modules/qrcode/handlers/qrcode-simple';

// 創建簡化版 QRCode 路由器
export const qrCodeRouterSimple = new Hono<{ Bindings: Bindings }>();

// ==================== ROUTE REGISTRATION (Proper Priority Order) ====================
// Routes MUST be registered in this order to avoid conflicts:
// 1. STATIC: /health
// 2. MULTI-SEGMENT: /:id/exists
// 3. SINGLE PARAMETERIZED: /:id (GET/PUT/DELETE)
// 4. WILDCARD: / (GET/POST) - MUST BE LAST!

// ==================== Priority 1: STATIC routes ====================
qrCodeRouterSimple.get('/health', qrCodeSimpleHandler.health);

// ==================== Priority 2: MULTI-SEGMENT routes ====================
qrCodeRouterSimple.get('/:id/exists', qrCodeSimpleHandler.checkExists);

// ==================== Priority 3: SINGLE PARAMETERIZED routes ====================
qrCodeRouterSimple.get('/:id', qrCodeSimpleHandler.getById);
qrCodeRouterSimple.put('/:id', qrCodeSimpleHandler.update);
qrCodeRouterSimple.delete('/:id', qrCodeSimpleHandler.delete);

// ==================== Priority 4: WILDCARD routes (MUST BE LAST!) ====================
// 處理帶和不帶尾隨斜線的情況
qrCodeRouterSimple.get('/', qrCodeSimpleHandler.list);
qrCodeRouterSimple.get('', qrCodeSimpleHandler.list); // 不帶斜線的版本
qrCodeRouterSimple.post('/', qrCodeSimpleHandler.create);
qrCodeRouterSimple.post('', qrCodeSimpleHandler.create); // 不帶斜線的版本

// 導出路由器
export default qrCodeRouterSimple;