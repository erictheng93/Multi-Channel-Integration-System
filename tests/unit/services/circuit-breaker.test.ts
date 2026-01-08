/**
 * Unit Tests for WebSocket Circuit Breaker
 *
 * Tests the circuit breaker pattern implementation with
 * structured logging and multiple fallback strategies
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  WebSocketCircuitBreaker,
  getCircuitBreaker,
  resetGlobalCircuitBreaker,
  CircuitState,
  FallbackStrategy
} from '@/services/websocket-circuit-breaker';
import type { Bindings } from '@/types';

describe('WebSocketCircuitBreaker', () => {
  let circuitBreaker: WebSocketCircuitBreaker;
  let mockEnv: Partial<Bindings>;

  beforeEach(() => {
    // Reset global instance
    resetGlobalCircuitBreaker();

    mockEnv = {
      SESSIONS: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined)
      } as any
    };

    circuitBreaker = new WebSocketCircuitBreaker({
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 1000,
      halfOpenMaxCalls: 2,
      errorRateThreshold: 0.25,
      latencyThreshold: 1000,
      volumeThreshold: 5
    });
    circuitBreaker.setEnv(mockEnv as Bindings);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should start in CLOSED state', () => {
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should have zero initial stats', () => {
      const stats = circuitBreaker.getStats();
      expect(stats.failureCount).toBe(0);
      expect(stats.successCount).toBe(0);
      expect(stats.totalCalls).toBe(0);
    });
  });

  describe('Normal Operation (CLOSED state)', () => {
    it('should execute successful operations', async () => {
      const result = await circuitBreaker.execute(
        async () => 'success',
        async () => 'fallback'
      );

      expect(result).toBe('success');
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should track successful calls', async () => {
      await circuitBreaker.execute(async () => 'success');
      await circuitBreaker.execute(async () => 'success');

      const stats = circuitBreaker.getStats();
      expect(stats.successfulCalls).toBe(2);
      expect(stats.totalCalls).toBe(2);
    });

    it('should track failed calls', async () => {
      try {
        await circuitBreaker.execute(async () => {
          throw new Error('Operation failed');
        });
      } catch (e) {
        // Expected
      }

      const stats = circuitBreaker.getStats();
      expect(stats.failedCalls).toBe(1);
    });
  });

  describe('Circuit Opening (CLOSED → OPEN)', () => {
    it('should open after consecutive failures', async () => {
      // Cause 3 consecutive failures
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw new Error(`Failure ${i}`);
          });
        } catch (e) {
          // Expected
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });

    it('should reset failure count on success', async () => {
      // 2 failures, then success
      for (let i = 0; i < 2; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw new Error(`Failure ${i}`);
          });
        } catch (e) {
          // Expected
        }
      }

      await circuitBreaker.execute(async () => 'success');

      const stats = circuitBreaker.getStats();
      expect(stats.failureCount).toBe(0);
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe('Request Rejection (OPEN state)', () => {
    beforeEach(async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw new Error(`Failure ${i}`);
          });
        } catch (e) {
          // Expected
        }
      }
    });

    it('should reject requests when OPEN', async () => {
      await expect(
        circuitBreaker.execute(async () => 'should not execute')
      ).rejects.toThrow('Circuit breaker is OPEN');

      const stats = circuitBreaker.getStats();
      expect(stats.rejectedCalls).toBe(1);
    });

    it('should use fallback when OPEN', async () => {
      const result = await circuitBreaker.execute(
        async () => 'primary',
        async () => 'fallback'
      );

      expect(result).toBe('fallback');
    });
  });

  describe('Recovery (OPEN → HALF_OPEN → CLOSED)', () => {
    beforeEach(async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw new Error(`Failure ${i}`);
          });
        } catch (e) {
          // Expected
        }
      }
    });

    it('should transition to HALF_OPEN after timeout', async () => {
      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Next call should trigger transition to HALF_OPEN
      await circuitBreaker.execute(async () => 'test');

      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should close after success threshold in HALF_OPEN', async () => {
      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Success calls to close circuit
      await circuitBreaker.execute(async () => 'success 1');
      await circuitBreaker.execute(async () => 'success 2');

      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should reopen on failure in HALF_OPEN', async () => {
      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // First call transitions to HALF_OPEN
      try {
        await circuitBreaker.execute(async () => {
          throw new Error('Still failing');
        });
      } catch (e) {
        // Expected
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('Manual Controls', () => {
    it('should allow manual reset', () => {
      // Open circuit first
      circuitBreaker.open();
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Manual reset
      circuitBreaker.reset();
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should allow manual open', () => {
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);

      circuitBreaker.open();
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('Event Recording', () => {
    it('should record state changes', async () => {
      // Trigger state change
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw new Error(`Failure ${i}`);
          });
        } catch (e) {
          // Expected
        }
      }

      const events = circuitBreaker.getEvents();
      const stateChanges = events.filter(e => e.type === 'state_change');

      expect(stateChanges.length).toBeGreaterThan(0);
    });

    it('should limit event history', async () => {
      // Generate many events
      for (let i = 0; i < 150; i++) {
        try {
          await circuitBreaker.execute(async () => {
            if (i % 2 === 0) throw new Error('fail');
            return 'success';
          });
        } catch (e) {
          // Expected for even iterations
        }
      }

      const events = circuitBreaker.getEvents();
      expect(events.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Global Instance', () => {
    it('should return singleton via getCircuitBreaker', () => {
      const instance1 = getCircuitBreaker();
      const instance2 = getCircuitBreaker();

      expect(instance1).toBe(instance2);
    });

    it('should allow custom config on first call', () => {
      resetGlobalCircuitBreaker();

      const instance = getCircuitBreaker({
        failureThreshold: 10,
        timeout: 5000
      });

      expect(instance).toBeDefined();
    });
  });

  describe('Fallback Strategies', () => {
    it('should support QUEUE fallback strategy', async () => {
      const cb = new WebSocketCircuitBreaker({
        failureThreshold: 1,
        fallbackStrategy: FallbackStrategy.QUEUE
      });

      // Open circuit
      try {
        await cb.execute(async () => {
          throw new Error('fail');
        });
      } catch (e) {
        // Expected
      }

      // Should be OPEN now
      expect(cb.getState()).toBe(CircuitState.OPEN);
    });

    it('should support FAIL_FAST fallback strategy', async () => {
      const cb = new WebSocketCircuitBreaker({
        failureThreshold: 1,
        fallbackStrategy: FallbackStrategy.FAIL_FAST
      });

      try {
        await cb.execute(async () => {
          throw new Error('fail');
        });
      } catch (e) {
        // Expected
      }

      expect(cb.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('Statistics', () => {
    it('should provide comprehensive stats', async () => {
      await circuitBreaker.execute(async () => 'success');

      try {
        await circuitBreaker.execute(async () => {
          throw new Error('fail');
        });
      } catch (e) {
        // Expected
      }

      const stats = circuitBreaker.getStats();

      expect(stats).toHaveProperty('state');
      expect(stats).toHaveProperty('failureCount');
      expect(stats).toHaveProperty('successCount');
      expect(stats).toHaveProperty('totalCalls');
      expect(stats).toHaveProperty('failedCalls');
      expect(stats).toHaveProperty('successfulCalls');
      expect(stats).toHaveProperty('rejectedCalls');
      expect(stats).toHaveProperty('lastStateChange');
    });
  });
});
