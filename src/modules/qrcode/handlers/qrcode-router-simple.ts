// 簡化版 QRCode 路由器
import { Hono } from 'hono';
import type { Bindings } from '../../../types';
import { qrCodeSimpleHandler } from '@modules/qrcode/handlers/qrcode-simple';

// 創建簡化版 QRCode 路由器
export const qrCodeRouterSimple = new Hono<{ Bindings: Bindings }>();

// 健康檢查
qrCodeRouterSimple.get('/health', qrCodeSimpleHandler.health);

// 基本 CRUD 路由
qrCodeRouterSimple.get('/', qrCodeSimpleHandler.list);
qrCodeRouterSimple.post('/', qrCodeSimpleHandler.create);
qrCodeRouterSimple.get('/:id', qrCodeSimpleHandler.getById);
qrCodeRouterSimple.put('/:id', qrCodeSimpleHandler.update);
qrCodeRouterSimple.delete('/:id', qrCodeSimpleHandler.delete);
qrCodeRouterSimple.get('/:id/exists', qrCodeSimpleHandler.checkExists);

// 導出路由器
export default qrCodeRouterSimple;