// Activities Module - Conflict Detection

export interface MidChange {
  field: string
  valueAtOriginalAction: unknown
  valueNow: unknown
  valueAfterRestore: unknown
}

function looseEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (a == null || b == null) return false

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((item, index) => looseEqual(item, b[index]))
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const aRecord = a as Record<string, unknown>
    const bRecord = b as Record<string, unknown>
    const aKeys = Object.keys(aRecord)
    const bKeys = Object.keys(bRecord)
    if (aKeys.length !== bKeys.length) return false
    return aKeys.every(key => Object.prototype.hasOwnProperty.call(bRecord, key) &&
      looseEqual(aRecord[key], bRecord[key]))
  }

  return false
}

export function diffStates(
  currentState: Record<string, unknown>,
  recordedNewState: Record<string, unknown>,
  previousState: Record<string, unknown>
): MidChange[] {
  const changes: MidChange[] = []

  for (const [field, valueAtOriginalAction] of Object.entries(recordedNewState)) {
    if (!looseEqual(currentState[field], valueAtOriginalAction)) {
      changes.push({
        field,
        valueAtOriginalAction,
        valueNow: currentState[field],
        valueAfterRestore: previousState[field]
      })
    }
  }

  return changes
}
