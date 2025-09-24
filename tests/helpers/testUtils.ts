// Legacy test utilities - DEPRECATED
// Use consolidatedTestUtils.ts instead

// Re-export from consolidated utilities for backward compatibility
export {
  createMockContext,
  extractResponseData,
  TestDataFactory
} from './consolidatedTestUtils'

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

// Import the consolidated version for everything else
import { TestDataFactory } from './consolidatedTestUtils'