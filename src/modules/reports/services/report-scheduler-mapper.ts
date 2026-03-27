// Report Scheduler Mapper — bridges ScheduledReport app type ↔ scheduledReports DB row

import type { ScheduledReport } from '../types/report-types';

/** Raw row shape from the scheduledReports table */
export interface ScheduledReportDbRow {
  id: string;
  name: string;
  description: string | null;
  reportType: string;
  reportFormat: string;
  reportParams: string;
  scheduleType: string;
  scheduleConfig: string;
  timezone: string | null;
  isActive: boolean | null;
  maxRetries: number | null;
  retryDelayMinutes: number | null;
  createdBy: string;
  teamId: number | null;
  notifyOnCompletion: boolean | null;
  notifyOnFailure: boolean | null;
  notificationEmails: string | null;
  nextExecutionAt: string | null;
  lastExecutionAt: string | null;
  lastExecutionStatus: string | null;
  executionCount: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  deletedAt: string | null;
}

export function toDbRow(report: ScheduledReport): Record<string, unknown> {
  return {
    id: report.id,
    name: report.name,
    reportType: report.type,
    reportFormat: report.format,
    reportParams: JSON.stringify({ filters: report.filters, options: report.options }),
    scheduleType: report.schedule.frequency,
    scheduleConfig: JSON.stringify({ time: report.schedule.time, dayOfWeek: report.schedule.dayOfWeek, dayOfMonth: report.schedule.dayOfMonth }),
    isActive: report.isActive,
    createdBy: report.createdBy,
    notificationEmails: report.recipients?.length ? JSON.stringify(report.recipients) : null,
    nextExecutionAt: report.nextRun,
    createdAt: report.createdAt,
    updatedAt: report.createdAt,
  };
}

export function fromDbRow(row: ScheduledReportDbRow): ScheduledReport {
  let params: { filters?: Record<string, unknown>; options?: Record<string, unknown> } = {};
  try { params = JSON.parse(row.reportParams); } catch { /* defaults */ }
  let sc: { time?: string; dayOfWeek?: number; dayOfMonth?: number } = {};
  try { sc = JSON.parse(row.scheduleConfig); } catch { /* defaults */ }
  let recipients: Array<{ email: string; name: string; role: string }> = [];
  if (row.notificationEmails) { try { recipients = JSON.parse(row.notificationEmails); } catch { /* empty */ } }
  return {
    id: row.id,
    name: row.name,
    type: row.reportType as ScheduledReport['type'],
    format: row.reportFormat as ScheduledReport['format'],
    schedule: { frequency: row.scheduleType as ScheduledReport['schedule']['frequency'], time: sc.time ?? '09:00', dayOfWeek: sc.dayOfWeek, dayOfMonth: sc.dayOfMonth },
    filters: (params.filters ?? {}) as ScheduledReport['filters'],
    options: (params.options ?? {}) as ScheduledReport['options'],
    recipients,
    isActive: !!row.isActive,
    createdBy: row.createdBy,
    createdAt: row.createdAt ?? '',
    lastRun: row.lastExecutionAt ?? undefined,
    nextRun: row.nextExecutionAt ?? '',
  };
}

export function toDbUpdate(updates: Partial<ScheduledReport>, nextExecutionAt?: string): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  if (updates.name !== undefined) r.name = updates.name;
  if (updates.type !== undefined) r.reportType = updates.type;
  if (updates.format !== undefined) r.reportFormat = updates.format;
  if (updates.isActive !== undefined) r.isActive = updates.isActive;
  if (updates.schedule !== undefined) {
    r.scheduleType = updates.schedule.frequency;
    r.scheduleConfig = JSON.stringify({ time: updates.schedule.time, dayOfWeek: updates.schedule.dayOfWeek, dayOfMonth: updates.schedule.dayOfMonth });
  }
  if (updates.filters !== undefined || updates.options !== undefined) {
    r.reportParams = JSON.stringify({ filters: updates.filters ?? {}, options: updates.options ?? {} });
  }
  if (updates.recipients !== undefined) r.notificationEmails = JSON.stringify(updates.recipients);
  if (nextExecutionAt !== undefined) r.nextExecutionAt = nextExecutionAt;
  return r;
}
