// src/modules/auto-reply/services/condition-matcher.ts
// Pure function: evaluates message content against a set of conditions

import type { AutoReplyConditionData, MatchMode } from '../types';
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('ConditionMatcher');

/**
 * Match message content against a set of conditions.
 * Returns true if conditions are satisfied based on matchMode.
 *
 * @param content - The incoming message text
 * @param messageType - The message type (e.g., 'text', 'image', 'sticker')
 * @param conditions - Array of conditions to evaluate
 * @returns boolean indicating whether conditions are met
 */
export function matchConditions(
  content: string,
  messageType: string,
  conditions: AutoReplyConditionData[]
): boolean {
  if (conditions.length === 0) {
    return false;
  }

  // Use the matchMode from the first condition (all conditions in a rule share the same matchMode)
  const matchMode: MatchMode = conditions[0].matchMode || 'any';

  const results = conditions.map((condition) => evaluateSingleCondition(content, messageType, condition));

  if (matchMode === 'all') {
    return results.every(Boolean);
  }

  // Default: 'any' — at least one condition must match (OR)
  return results.some(Boolean);
}

/**
 * Evaluate a single condition against the message content.
 */
function evaluateSingleCondition(
  content: string,
  messageType: string,
  condition: AutoReplyConditionData
): boolean {
  try {
    switch (condition.conditionType) {
      case 'exact':
        return matchExact(content, condition.value, condition.caseSensitive);

      case 'contains':
        return matchContains(content, condition.value, condition.caseSensitive);

      case 'regex':
        return matchRegex(content, condition.value, condition.caseSensitive);

      case 'message_type':
        return messageType === condition.value;

      default:
        log.warn('Unknown condition type', { conditionType: condition.conditionType });
        return false;
    }
  } catch (error) {
    log.error('Error evaluating condition', {
      conditionType: condition.conditionType,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

function matchExact(content: string, value: string, caseSensitive: boolean): boolean {
  const trimmedContent = content.trim();
  if (caseSensitive) {
    return trimmedContent === value;
  }
  return trimmedContent.toLowerCase() === value.toLowerCase();
}

function matchContains(content: string, value: string, caseSensitive: boolean): boolean {
  if (caseSensitive) {
    return content.includes(value);
  }
  return content.toLowerCase().includes(value.toLowerCase());
}

function matchRegex(content: string, pattern: string, caseSensitive: boolean): boolean {
  try {
    const flags = caseSensitive ? '' : 'i';
    const regex = new RegExp(pattern, flags);
    return regex.test(content);
  } catch {
    // Invalid regex pattern — skip this condition
    log.warn('Invalid regex pattern in auto-reply condition', { pattern });
    return false;
  }
}
