/**
 * ============================================================================
 * Pixel VRT — Pinia seeding
 * ============================================================================
 *
 * Some covered components read Pinia state during setup (`QuickAssignActions`
 * via `useAuth()`, `TeamCard` via `useAuthStore()`), so a real store instance
 * has to exist and hold a signed-in agent.
 *
 * IMPORTANT: this writes store state directly. It never calls `login()` and
 * never touches `authApi`, so no request reaches the production Worker and no
 * credential is needed. `initializeSession()` is likewise never invoked.
 * ============================================================================
 */

import type { Pinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { MOCK_AGENT } from './data'

export function seedStores(pinia: Pinia): void {
  const auth = useAuthStore(pinia)

  // `auth` is a setup store, so its refs are exposed as writable properties.
  auth.currentAgent = MOCK_AGENT
  auth.sessionStatus = 'authenticated'
}
