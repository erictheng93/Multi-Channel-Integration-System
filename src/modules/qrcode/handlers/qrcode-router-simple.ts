// 簡化版 QRCode 路由器
import { Hono } from 'hono';
import type { Bindings } from '@/types';
import { qrCodeSimpleHandler } from '@modules/qrcode/handlers/qrcode-simple';

// 創建簡化版 QRCode 路由器
export const qrCodeRouterSimple = new Hono<{ Bindings: Bindings }>();

// 健康檢查
qrCodeRouterSimple.get('/health', qrCodeSimpleHandler.health);

// 基本 CRUD 路由 - 同時處理帶和不帶尾隨斜線的情況
qrCodeRouterSimple.get('/', qrCodeSimpleHandler.list);
qrCodeRouterSimple.get('', qrCodeSimpleHandler.list); // 不帶斜線的版本
qrCodeRouterSimple.post('/', qrCodeSimpleHandler.create);
qrCodeRouterSimple.post('', qrCodeSimpleHandler.create); // 不帶斜線的版本

// 參數路由必須在前面以避免與靜態路由衝突
qrCodeRouterSimple.get('/:id/exists', qrCodeSimpleHandler.checkExists);
qrCodeRouterSimple.get('/:id', qrCodeSimpleHandler.getById);
qrCodeRouterSimple.put('/:id', qrCodeSimpleHandler.update);
qrCodeRouterSimple.delete('/:id', qrCodeSimpleHandler.delete);

// 導出路由器
export default qrCodeRouterSimple;