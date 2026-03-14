/**
 * Unit tests for type-normalization utilities
 *
 * These tests ensure that type normalization handles all edge cases
 * that can occur when data crosses system boundaries (WebSocket, API, etc.)
 */

import { describe, it, expect } from 'vitest'
import {
  normalizeTeamId,
  normalizeTeamIds,
  normalizeStringId
} from './type-normalization'

describe('type-normalization utilities', () => {
  describe('normalizeTeamId', () => {
    describe('valid number inputs', () => {
      it('should return number as-is for positive integers', () => {
        expect(normalizeTeamId(42)).toBe(42)
        expect(normalizeTeamId(1)).toBe(1)
        expect(normalizeTeamId(999999)).toBe(999999)
      })

      it('should return zero for zero input', () => {
        expect(normalizeTeamId(0)).toBe(0)
      })

      it('should handle negative numbers', () => {
        expect(normalizeTeamId(-1)).toBe(-1)
        expect(normalizeTeamId(-100)).toBe(-100)
      })

      it('should handle floating point numbers (returns as-is)', () => {
        expect(normalizeTeamId(3.14)).toBe(3.14)
        expect(normalizeTeamId(42.0)).toBe(42)
      })
    })

    describe('valid string inputs', () => {
      it('should convert numeric strings to numbers', () => {
        expect(normalizeTeamId('42')).toBe(42)
        expect(normalizeTeamId('1')).toBe(1)
        expect(normalizeTeamId('999999')).toBe(999999)
      })

      it('should convert "0" to 0', () => {
        expect(normalizeTeamId('0')).toBe(0)
      })

      it('should handle negative numeric strings', () => {
        expect(normalizeTeamId('-1')).toBe(-1)
        expect(normalizeTeamId('-100')).toBe(-100)
      })

      it('should handle strings with leading zeros', () => {
        expect(normalizeTeamId('007')).toBe(7)
        expect(normalizeTeamId('042')).toBe(42)
      })

      it('should handle strings with whitespace (parseInt behavior)', () => {
        // Note: parseInt trims leading whitespace
        expect(normalizeTeamId('  42')).toBe(42)
        expect(normalizeTeamId('42  ')).toBe(42)
      })
    })

    describe('null and undefined inputs', () => {
      it('should return undefined for undefined input', () => {
        expect(normalizeTeamId(undefined)).toBeUndefined()
      })

      it('should return undefined for null input', () => {
        expect(normalizeTeamId(null)).toBeUndefined()
      })
    })

    describe('invalid inputs', () => {
      it('should return undefined for NaN number', () => {
        expect(normalizeTeamId(NaN)).toBeUndefined()
      })

      it('should return undefined for non-numeric strings', () => {
        expect(normalizeTeamId('abc')).toBeUndefined()
        expect(normalizeTeamId('team-42')).toBeUndefined()
        expect(normalizeTeamId('42abc')).toBe(42) // parseInt behavior
        expect(normalizeTeamId('abc42')).toBeUndefined()
      })

      it('should return undefined for empty string', () => {
        expect(normalizeTeamId('')).toBeUndefined()
      })

      it('should return undefined for whitespace-only string', () => {
        expect(normalizeTeamId(' ')).toBeUndefined()
      })

      it('should return undefined for boolean inputs', () => {
        expect(normalizeTeamId(true as unknown)).toBeUndefined()
        expect(normalizeTeamId(false as unknown)).toBeUndefined()
      })

      it('should return undefined for object inputs', () => {
        expect(normalizeTeamId({} as unknown)).toBeUndefined()
        expect(normalizeTeamId({ id: 42 } as unknown)).toBeUndefined()
        expect(normalizeTeamId([] as unknown)).toBeUndefined()
      })

      it('should return undefined for function inputs', () => {
        expect(normalizeTeamId((() => 42) as unknown)).toBeUndefined()
      })

      it('should return undefined for symbol inputs', () => {
        expect(normalizeTeamId(Symbol('42') as unknown)).toBeUndefined()
      })
    })

    describe('edge cases from real WebSocket data', () => {
      it('should handle team ID as string from JSON.parse', () => {
        // Simulates: JSON.parse('{"toTeamId": "42"}').toTeamId
        const jsonData = JSON.parse('{"toTeamId": "42"}')
        expect(normalizeTeamId(jsonData.toTeamId)).toBe(42)
      })

      it('should handle team ID as number from JSON.parse', () => {
        // Simulates: JSON.parse('{"toTeamId": 42}').toTeamId
        const jsonData = JSON.parse('{"toTeamId": 42}')
        expect(normalizeTeamId(jsonData.toTeamId)).toBe(42)
      })

      it('should handle missing team ID from JSON.parse', () => {
        const jsonData = JSON.parse('{"otherField": "value"}')
        expect(normalizeTeamId(jsonData.toTeamId)).toBeUndefined()
      })
    })
  })

  describe('normalizeTeamIds', () => {
    describe('valid array inputs', () => {
      it('should return array of numbers for number array', () => {
        expect(normalizeTeamIds([1, 2, 3])).toEqual([1, 2, 3])
        expect(normalizeTeamIds([42])).toEqual([42])
      })

      it('should convert string array to number array', () => {
        expect(normalizeTeamIds(['1', '2', '3'])).toEqual([1, 2, 3])
        expect(normalizeTeamIds(['42'])).toEqual([42])
      })

      it('should handle mixed string and number array', () => {
        expect(normalizeTeamIds([1, '2', 3, '4'])).toEqual([1, 2, 3, 4])
        expect(normalizeTeamIds(['1', 2, '3', 4])).toEqual([1, 2, 3, 4])
      })

      it('should return empty array for empty input', () => {
        expect(normalizeTeamIds([])).toEqual([])
      })

      it('should handle array with zero', () => {
        expect(normalizeTeamIds([0, 1, 2])).toEqual([0, 1, 2])
        expect(normalizeTeamIds(['0', '1'])).toEqual([0, 1])
      })
    })

    describe('filtering invalid values', () => {
      it('should filter out null and undefined values', () => {
        expect(normalizeTeamIds([1, null, 2, undefined, 3])).toEqual([1, 2, 3])
      })

      it('should filter out non-numeric strings', () => {
        expect(normalizeTeamIds([1, 'abc', 2, 'def', 3])).toEqual([1, 2, 3])
      })

      it('should filter out NaN values', () => {
        expect(normalizeTeamIds([1, NaN, 2, NaN, 3])).toEqual([1, 2, 3])
      })

      it('should filter out objects and arrays', () => {
        expect(normalizeTeamIds([1, {}, 2, [], 3])).toEqual([1, 2, 3])
      })

      it('should return empty array when all values are invalid', () => {
        expect(normalizeTeamIds([null, undefined, 'abc', NaN])).toEqual([])
      })
    })

    describe('non-array inputs', () => {
      it('should return empty array for null', () => {
        expect(normalizeTeamIds(null)).toEqual([])
      })

      it('should return empty array for undefined', () => {
        expect(normalizeTeamIds(undefined)).toEqual([])
      })

      it('should return empty array for string', () => {
        expect(normalizeTeamIds('42' as unknown)).toEqual([])
      })

      it('should return empty array for number', () => {
        expect(normalizeTeamIds(42 as unknown)).toEqual([])
      })

      it('should return empty array for object', () => {
        expect(normalizeTeamIds({ 0: 1, 1: 2 } as unknown)).toEqual([])
      })
    })

    describe('edge cases from real JWT data', () => {
      it('should handle allowedTeamIds from JWT payload', () => {
        // Simulates: JWT payload with number array
        const jwtPayload = { allowedTeamIds: [1, 2, 5] }
        expect(normalizeTeamIds(jwtPayload.allowedTeamIds)).toEqual([1, 2, 5])
      })

      it('should handle mixed types from deserialization', () => {
        // Some serializers might produce mixed types
        const mixedPayload = { teamIds: [1, '2', 3, '4'] }
        expect(normalizeTeamIds(mixedPayload.teamIds)).toEqual([1, 2, 3, 4])
      })
    })
  })

  describe('normalizeStringId', () => {
    describe('valid string inputs', () => {
      it('should return string as-is', () => {
        expect(normalizeStringId('conv-123')).toBe('conv-123')
        expect(normalizeStringId('abc')).toBe('abc')
        expect(normalizeStringId('123')).toBe('123')
      })

      it('should trim whitespace from strings', () => {
        expect(normalizeStringId('  conv-123  ')).toBe('conv-123')
        expect(normalizeStringId('  abc')).toBe('abc')
        expect(normalizeStringId('123  ')).toBe('123')
      })

      it('should return undefined for empty string', () => {
        expect(normalizeStringId('')).toBeUndefined()
      })

      it('should return undefined for whitespace-only string', () => {
        expect(normalizeStringId(' ')).toBeUndefined()
        expect(normalizeStringId('\t\n')).toBeUndefined()
      })
    })

    describe('number inputs', () => {
      it('should convert positive numbers to strings', () => {
        expect(normalizeStringId(42)).toBe('42')
        expect(normalizeStringId(123456)).toBe('123456')
      })

      it('should convert zero to string', () => {
        expect(normalizeStringId(0)).toBe('0')
      })

      it('should convert negative numbers to strings', () => {
        expect(normalizeStringId(-1)).toBe('-1')
      })

      it('should convert floating point numbers to strings', () => {
        expect(normalizeStringId(3.14)).toBe('3.14')
      })
    })

    describe('null and undefined inputs', () => {
      it('should return undefined for undefined', () => {
        expect(normalizeStringId(undefined)).toBeUndefined()
      })

      it('should return undefined for null', () => {
        expect(normalizeStringId(null)).toBeUndefined()
      })
    })

    describe('invalid inputs', () => {
      it('should return undefined for boolean', () => {
        expect(normalizeStringId(true as unknown)).toBeUndefined()
        expect(normalizeStringId(false as unknown)).toBeUndefined()
      })

      it('should return undefined for objects', () => {
        expect(normalizeStringId({} as unknown)).toBeUndefined()
        expect(normalizeStringId({ id: '123' } as unknown)).toBeUndefined()
      })

      it('should return undefined for arrays', () => {
        expect(normalizeStringId([] as unknown)).toBeUndefined()
        expect(normalizeStringId(['123'] as unknown)).toBeUndefined()
      })

      it('should return undefined for functions', () => {
        expect(normalizeStringId((() => '123') as unknown)).toBeUndefined()
      })
    })

    describe('edge cases from real API data', () => {
      it('should handle conversation ID from API response', () => {
        const apiResponse = { conversationId: 'conv-abc-123' }
        expect(normalizeStringId(apiResponse.conversationId)).toBe('conv-abc-123')
      })

      it('should handle numeric customer ID from database', () => {
        const dbRecord = { customerId: 12345 }
        expect(normalizeStringId(dbRecord.customerId)).toBe('12345')
      })

      it('should handle missing ID field', () => {
        const partialData = { name: 'Test' }
        expect(normalizeStringId((partialData as any).id)).toBeUndefined()
      })
    })
  })

  describe('integration scenarios', () => {
    it('should handle WebSocket conversation_transferred event normalization', () => {
      // Simulates real WebSocket event data
      const wsEvent = {
        type: 'conversation_transferred',
        data: {
          conversationId: 'conv-123',
          fromTeamId: '42',  // String from JSON
          toTeamId: 100, // Number
          action: 'removed'
        }
      }

      const fromTeamId = normalizeTeamId(wsEvent.data.fromTeamId)
      const toTeamId = normalizeTeamId(wsEvent.data.toTeamId)
      const userTeamIds = [42, 100, 200]

      // Now .includes() works correctly
      expect(fromTeamId).toBe(42)
      expect(toTeamId).toBe(100)
      expect(userTeamIds.includes(fromTeamId!)).toBe(true)
      expect(userTeamIds.includes(toTeamId!)).toBe(true)
    })

    it('should handle mixed type comparison that previously failed', () => {
      // This was the original bug: "42" !== 42
      const wsTeamId = '42'  // From WebSocket JSON
      const userTeamIds = [42, 100]  // From JWT (numbers)

      // Before fix: userTeamIds.includes(wsTeamId) → false
      // After fix: userTeamIds.includes(normalizeTeamId(wsTeamId)) → true
      const normalizedId = normalizeTeamId(wsTeamId)
      expect(userTeamIds.includes(normalizedId!)).toBe(true)
    })

    it('should preserve undefined for missing optional fields', () => {
      const eventWithoutFromTeam = {
        toTeamId: 42,
        fromTeamId: undefined
      }

      expect(normalizeTeamId(eventWithoutFromTeam.toTeamId)).toBe(42)
      expect(normalizeTeamId(eventWithoutFromTeam.fromTeamId)).toBeUndefined()
    })
  })
})
