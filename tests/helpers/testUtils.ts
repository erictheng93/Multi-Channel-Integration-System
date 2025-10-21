// Backend Test Utilities
// For backend tests - uses consolidatedBackendTestUtils (no pinia/frontend dependencies)
// For frontend tests, use consolidatedTestUtils.ts directly

// Re-export from consolidated BACKEND utilities for backward compatibility
export {
  createMockContext,
  extractResponseData,
  TestDataFactory
} from './consolidatedBackendTestUtils'

// Legacy exports (deprecated - use TestDataFactory instead)
export const createMockJWTPayload = (overrides: any = {}) =>
  ({ ...TestDataFactory.createJWTPayload(overrides) } as any)

export const createMockAdminJWTPayload = (overrides: any = {}) =>
  ({ ...TestDataFactory.createAdminJWTPayload(overrides) } as any)

export const createMockCustomer = (overrides: any = {}) =>
  ({ ...TestDataFactory.createCustomer(overrides) } as any)

export const createMockAgent = (overrides: any = {}) =>
  ({ ...TestDataFactory.createAgent(overrides) } as any)

export const createMockConversation = (overrides: any = {}) =>
  ({ ...TestDataFactory.createConversation(overrides) } as any)

export const createMockMessage = (overrides: any = {}) =>
  ({ ...TestDataFactory.createMessage(overrides) } as any)

// Import the consolidated BACKEND version for everything else
import { TestDataFactory } from './consolidatedBackendTestUtils'