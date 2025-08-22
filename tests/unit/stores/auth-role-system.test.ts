import { describe, test, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from '../../../frontend/src/stores/auth';
import type { Agent } from '../../../frontend/src/types';

// Mock auth API
vi.mock('../../../frontend/src/api/auth', () => ({
  authApi: {
    login: vi.fn(),
    me: vi.fn(),
    setAuthHeader: vi.fn(),
    removeAuthHeader: vi.fn()
  }
}));

// Mock router
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn()
  }))
}));

describe('Auth Store 3-Role System Support', () => {
  let pinia: any;

  beforeEach(() => {
    vi.clearAllMocks();
    pinia = createPinia();
    setActivePinia(pinia);

    // Mock localStorage
    const mockLocalStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    };

    Object.defineProperty(global, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true
    });

    Object.defineProperty(global, 'window', {
      value: {
        localStorage: mockLocalStorage,
        location: { href: 'http://localhost:3000' }
      },
      writable: true
    });
  });

  describe('Role-Based Computed Properties', () => {
    test('should correctly identify admin role', () => {
      const authStore = useAuthStore();
      
      const adminAgent: Agent = {
        id: '1',
        email: 'admin@test.com',
        name: 'Admin User',
        role: 'admin',
        isActive: true,
        createdAt: Date.now()
      };

      authStore.currentAgent = adminAgent;

      expect(authStore.isAdmin).toBe(true);
      expect(authStore.isManager).toBe(false);
      expect(authStore.isAgent).toBe(false);
      expect(authStore.isManagerOrAdmin).toBe(true);
    });

    test('should correctly identify manager role', () => {
      const authStore = useAuthStore();
      
      const managerAgent: Agent = {
        id: '2',
        email: 'manager@test.com',
        name: 'Manager User',
        role: 'manager',
        isActive: true,
        createdAt: Date.now()
      };

      authStore.currentAgent = managerAgent;

      expect(authStore.isAdmin).toBe(false);
      expect(authStore.isManager).toBe(true);
      expect(authStore.isAgent).toBe(false);
      expect(authStore.isManagerOrAdmin).toBe(true);
    });

    test('should correctly identify agent role', () => {
      const authStore = useAuthStore();
      
      const agentUser: Agent = {
        id: '3',
        email: 'agent@test.com',
        name: 'Agent User',
        role: 'agent',
        isActive: true,
        createdAt: Date.now()
      };

      authStore.currentAgent = agentUser;

      expect(authStore.isAdmin).toBe(false);
      expect(authStore.isManager).toBe(false);
      expect(authStore.isAgent).toBe(true);
      expect(authStore.isManagerOrAdmin).toBe(false);
    });

    test('should handle null currentAgent gracefully', () => {
      const authStore = useAuthStore();
      authStore.currentAgent = null;

      expect(authStore.isAdmin).toBe(false);
      expect(authStore.isManager).toBe(false);
      expect(authStore.isAgent).toBe(false);
      expect(authStore.isManagerOrAdmin).toBe(false);
    });

    test('should handle undefined role gracefully', () => {
      const authStore = useAuthStore();
      
      const agentWithUndefinedRole: any = {
        id: '4',
        email: 'user@test.com',
        name: 'User',
        role: undefined,
        isActive: true,
        createdAt: Date.now()
      };

      authStore.currentAgent = agentWithUndefinedRole;

      expect(authStore.isAdmin).toBe(false);
      expect(authStore.isManager).toBe(false);
      expect(authStore.isAgent).toBe(false);
      expect(authStore.isManagerOrAdmin).toBe(false);
    });
  });

  describe('Authentication with Different Roles', () => {
    test('should authenticate admin user successfully', async () => {
      const { authApi } = await import('../../../frontend/src/api/auth');
      const authStore = useAuthStore();

      const adminLoginResponse = {
        success: true,
        data: {
          token: 'admin-jwt-token',
          refreshToken: 'admin-refresh-token',
          agent: {
            id: '1',
            email: 'admin@test.com',
            name: 'Admin User',
            role: 'admin',
            isActive: true,
            createdAt: Date.now()
          }
        }
      };

      (authApi.login as any).mockResolvedValueOnce(adminLoginResponse);

      await authStore.login({
        email: 'admin@test.com',
        password: 'password123'
      });

      expect(authStore.currentAgent?.role).toBe('admin');
      expect(authStore.isAdmin).toBe(true);
      expect(authStore.isManagerOrAdmin).toBe(true);
    });

    test('should authenticate manager user successfully', async () => {
      const { authApi } = await import('../../../frontend/src/api/auth');
      const authStore = useAuthStore();

      const managerLoginResponse = {
        success: true,
        data: {
          token: 'manager-jwt-token',
          refreshToken: 'manager-refresh-token',
          agent: {
            id: '2',
            email: 'manager@test.com',
            name: 'Manager User',
            role: 'manager',
            isActive: true,
            createdAt: Date.now()
          }
        }
      };

      (authApi.login as any).mockResolvedValueOnce(managerLoginResponse);

      await authStore.login({
        email: 'manager@test.com',
        password: 'password123'
      });

      expect(authStore.currentAgent?.role).toBe('manager');
      expect(authStore.isManager).toBe(true);
      expect(authStore.isManagerOrAdmin).toBe(true);
    });

    test('should authenticate agent user successfully', async () => {
      const { authApi } = await import('../../../frontend/src/api/auth');
      const authStore = useAuthStore();

      const agentLoginResponse = {
        success: true,
        data: {
          token: 'agent-jwt-token',
          refreshToken: 'agent-refresh-token',
          agent: {
            id: '3',
            email: 'agent@test.com',
            name: 'Agent User',
            role: 'agent',
            isActive: true,
            createdAt: Date.now()
          }
        }
      };

      (authApi.login as any).mockResolvedValueOnce(agentLoginResponse);

      await authStore.login({
        email: 'agent@test.com',
        password: 'password123'
      });

      expect(authStore.currentAgent?.role).toBe('agent');
      expect(authStore.isAgent).toBe(true);
      expect(authStore.isManagerOrAdmin).toBe(false);
    });
  });

  describe('Role Persistence and Session Management', () => {
    test('should persist admin role in localStorage', async () => {
      const authStore = useAuthStore();
      const mockLocalStorage = global.localStorage;

      const adminAgent: Agent = {
        id: '1',
        email: 'admin@test.com',
        name: 'Admin User',
        role: 'admin',
        isActive: true,
        createdAt: Date.now()
      };

      authStore.currentAgent = adminAgent;
      authStore.token = 'admin-token';

      // Simulate setting session data
      const sessionExpiry = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
      authStore.sessionExpiry = sessionExpiry;

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    test('should persist manager role in localStorage', async () => {
      const authStore = useAuthStore();
      const mockLocalStorage = global.localStorage;

      const managerAgent: Agent = {
        id: '2',
        email: 'manager@test.com',
        name: 'Manager User',
        role: 'manager',
        isActive: true,
        createdAt: Date.now()
      };

      authStore.currentAgent = managerAgent;
      authStore.token = 'manager-token';

      // Simulate setting session data
      const sessionExpiry = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
      authStore.sessionExpiry = sessionExpiry;

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('Role-Based Authorization States', () => {
    test('should maintain proper authentication state for admin', () => {
      const authStore = useAuthStore();
      
      authStore.token = 'valid-admin-token';
      authStore.sessionExpiry = Date.now() + (24 * 60 * 60 * 1000); // 1 day
      authStore.currentAgent = {
        id: '1',
        email: 'admin@test.com',
        name: 'Admin User',
        role: 'admin',
        isActive: true,
        createdAt: Date.now()
      };
      authStore.error = null;

      expect(authStore.isAuthenticated).toBe(true);
      expect(authStore.isAdmin).toBe(true);
    });

    test('should maintain proper authentication state for manager', () => {
      const authStore = useAuthStore();
      
      authStore.token = 'valid-manager-token';
      authStore.sessionExpiry = Date.now() + (24 * 60 * 60 * 1000); // 1 day
      authStore.currentAgent = {
        id: '2',
        email: 'manager@test.com',
        name: 'Manager User',
        role: 'manager',
        isActive: true,
        createdAt: Date.now()
      };
      authStore.error = null;

      expect(authStore.isAuthenticated).toBe(true);
      expect(authStore.isManager).toBe(true);
      expect(authStore.isManagerOrAdmin).toBe(true);
    });

    test('should maintain proper authentication state for agent', () => {
      const authStore = useAuthStore();
      
      authStore.token = 'valid-agent-token';
      authStore.sessionExpiry = Date.now() + (24 * 60 * 60 * 1000); // 1 day
      authStore.currentAgent = {
        id: '3',
        email: 'agent@test.com',
        name: 'Agent User',
        role: 'agent',
        isActive: true,
        createdAt: Date.now()
      };
      authStore.error = null;

      expect(authStore.isAuthenticated).toBe(true);
      expect(authStore.isAgent).toBe(true);
      expect(authStore.isManagerOrAdmin).toBe(false);
    });
  });

  describe('Role Transition Handling', () => {
    test('should handle role change from agent to manager', () => {
      const authStore = useAuthStore();

      // Initially an agent
      authStore.currentAgent = {
        id: '3',
        email: 'user@test.com',
        name: 'User',
        role: 'agent',
        isActive: true,
        createdAt: Date.now()
      };

      expect(authStore.isAgent).toBe(true);
      expect(authStore.isManager).toBe(false);

      // Role promoted to manager
      authStore.currentAgent = {
        ...authStore.currentAgent,
        role: 'manager'
      };

      expect(authStore.isAgent).toBe(false);
      expect(authStore.isManager).toBe(true);
      expect(authStore.isManagerOrAdmin).toBe(true);
    });

    test('should handle role change from manager to admin', () => {
      const authStore = useAuthStore();

      // Initially a manager
      authStore.currentAgent = {
        id: '2',
        email: 'manager@test.com',
        name: 'Manager',
        role: 'manager',
        isActive: true,
        createdAt: Date.now()
      };

      expect(authStore.isManager).toBe(true);
      expect(authStore.isAdmin).toBe(false);

      // Role promoted to admin
      authStore.currentAgent = {
        ...authStore.currentAgent,
        role: 'admin'
      };

      expect(authStore.isManager).toBe(false);
      expect(authStore.isAdmin).toBe(true);
      expect(authStore.isManagerOrAdmin).toBe(true);
    });
  });

  describe('Logout and Role Cleanup', () => {
    test('should clear all role states on logout', async () => {
      const authStore = useAuthStore();

      // Set up authenticated admin
      authStore.currentAgent = {
        id: '1',
        email: 'admin@test.com',
        name: 'Admin',
        role: 'admin',
        isActive: true,
        createdAt: Date.now()
      };
      authStore.token = 'admin-token';

      expect(authStore.isAdmin).toBe(true);

      // Logout
      await authStore.logout();

      expect(authStore.currentAgent).toBeNull();
      expect(authStore.token).toBeNull();
      expect(authStore.isAdmin).toBe(false);
      expect(authStore.isManager).toBe(false);
      expect(authStore.isAgent).toBe(false);
      expect(authStore.isManagerOrAdmin).toBe(false);
    });
  });
});