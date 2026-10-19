// Credentials management routes — extracted from src/index.ts
// Platform credential storage, retrieval, and backup

import { Hono } from 'hono';
import type { Bindings } from '../types';
import { jwtAuth, requireAdmin } from '../middleware/auth';
import {
  storeCredential,
  getCredential,
  getAllCredentials,
  clearPlatformCredentials,
  backupCredentials
} from '@modules/auth/handlers/credentials';

const router = new Hono<{ Bindings: Bindings }>();

router.post('/', jwtAuth, requireAdmin(), storeCredential);
router.get('/:platform/:type', jwtAuth, requireAdmin(), getCredential);
router.get('/', jwtAuth, requireAdmin(), getAllCredentials);
router.delete('/:platform', jwtAuth, requireAdmin(), clearPlatformCredentials);
router.get('/backup', jwtAuth, requireAdmin(), backupCredentials);

export default router;
