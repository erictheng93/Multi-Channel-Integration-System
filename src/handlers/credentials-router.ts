// Credentials management routes — extracted from src/index.ts
// Platform credential storage, retrieval, and backup

import { Hono } from 'hono';
import type { Bindings } from '../types';
import { jwtAuth } from '../middleware/auth';
import {
  storeCredential,
  getCredential,
  getAllCredentials,
  clearPlatformCredentials,
  backupCredentials
} from '@modules/auth/handlers/credentials';

const router = new Hono<{ Bindings: Bindings }>();

router.post('/', jwtAuth, storeCredential);
router.get('/:platform/:type', jwtAuth, getCredential);
router.get('/', jwtAuth, getAllCredentials);
router.delete('/:platform', jwtAuth, clearPlatformCredentials);
router.get('/backup', jwtAuth, backupCredentials);

export default router;
