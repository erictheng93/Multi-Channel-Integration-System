/**
 * Type Normalization Utilities
 *
 * These utilities handle type mismatches that occur when data crosses system boundaries
 * (e.g., WebSocket JSON → TypeScript, API responses → stores).
 *
 * DESIGN PRINCIPLE: Normalize at the boundary, not at every usage point.
 * This ensures type safety throughout the application while handling
 * the reality of JSON serialization producing mixed types.
 *
 * @example
 * // In WebSocket event handler (boundary):
 * const toTeamId = normalizeTeamId(data?.toTeamId)
 *
 * // Now all downstream code works with correct types:
 * userTeamIds.includes(toTeamId) //  Works correctly
 */

/**
 * Normalizes a team ID from unknown input to number | undefined.
 * Handles both string and number inputs from JSON deserialization.
 *
 * @param id - The raw team ID from WebSocket/API (could be string, number, null, undefined)
 * @returns number | undefined - Normalized team ID or undefined if invalid
 *
 * @example
 * normalizeTeamId("42") // → 42
 * normalizeTeamId(42) // → 42
 * normalizeTeamId(null) // → undefined
 * normalizeTeamId(undefined)// → undefined
 * normalizeTeamId("abc") // → undefined (NaN case)
 */
export function normalizeTeamId(id: unknown): number | undefined {
  if (id === undefined || id === null) {
    return undefined
  }

  // Already a number
  if (typeof id === 'number') {
    return isNaN(id) ? undefined : id
  }

  // String that needs conversion
  if (typeof id === 'string') {
    const parsed = parseInt(id, 10)
    return isNaN(parsed) ? undefined : parsed
  }

  // Any other type is invalid
  return undefined
}

/**
 * Normalizes an array of team IDs from unknown input to number[].
 * Filters out any invalid IDs.
 *
 * @param ids - Raw array of team IDs
 * @returns number[] - Array of valid normalized team IDs
 *
 * @example
 * normalizeTeamIds(["1", 2, "3"])  // → [1, 2, 3]
 * normalizeTeamIds([1, "abc", 3])  // → [1, 3]
 * normalizeTeamIds(null) // → []
 */
export function normalizeTeamIds(ids: unknown): number[] {
  if (!Array.isArray(ids)) {
    return []
  }

  return ids
    .map(id => normalizeTeamId(id))
    .filter((id): id is number => id !== undefined)
}

/**
 * Normalizes a generic ID (conversation, customer, etc.) to string.
 * Most IDs in this system are strings, but API/WebSocket might send numbers.
 *
 * @param id - The raw ID
 * @returns string | undefined
 */
export function normalizeStringId(id: unknown): string | undefined {
  if (id === undefined || id === null) {
    return undefined
  }

  if (typeof id === 'string') {
    return id.trim() || undefined
  }

  if (typeof id === 'number') {
    return String(id)
  }

  return undefined
}
