// Analytics Formatters - Output formatting utilities for labels, colors, and display values

/**
 * Format a time label based on the aggregation level
 */
export function formatTimeLabel(timestamp: string, aggregation: string): string {
  const date = new Date(timestamp);
  switch (aggregation) {
    case 'hourly':
      return date.toLocaleString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit' });
    case 'daily':
      return date.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' });
    case 'weekly':
      return `Week ${timestamp.split('W')[1]}`;
    case 'monthly':
      return date.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' });
    default:
      return timestamp;
  }
}

/**
 * Get a human-readable label for a conversation status
 */
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    'active': '進行中',
    'pending': '待處理',
    'closed': '已關閉'
  };
  return labels[status] || status;
}

/**
 * Get the display color for a conversation status
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    'active': '#10b981',
    'pending': '#f59e0b',
    'closed': '#6b7280'
  };
  return colors[status] || '#9ca3af';
}

/**
 * Get a human-readable label for a priority level
 */
export function getPriorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    'low': '低優先級',
    'normal': '一般',
    'high': '高優先級',
    'urgent': '緊急'
  };
  return labels[priority] || priority;
}

/**
 * Get the display color for a priority level
 */
export function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    'low': '#3b82f6',
    'normal': '#10b981',
    'high': '#f59e0b',
    'urgent': '#ef4444'
  };
  return colors[priority] || '#9ca3af';
}

/**
 * Get the display color for a team, cycling through a palette based on team ID
 */
export function getTeamColor(teamId: number | null): string {
  if (!teamId) return '#9ca3af';
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  return colors[teamId % colors.length];
}
