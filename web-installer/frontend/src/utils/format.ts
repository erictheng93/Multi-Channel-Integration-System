/**
 * Shared formatting utilities for the web installer frontend.
 */

/**
 * Format a duration in seconds into a human-readable string.
 * @example formatDuration(90) → "1m 30s"
 * @example formatDuration(45) → "45s"
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}
