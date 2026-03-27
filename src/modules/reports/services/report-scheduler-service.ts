// Report Scheduler Service — CRUD + cron execution for scheduled reports

import type { Bindings } from '@/types';
import type { ScheduledReport } from '../types/report-types';
import { ReportGenerationError } from '../types/report-types';
import { nowISO } from '@/utils/timestamp';
import logger from '@/utils/logger';
import { toDbRow, fromDbRow, toDbUpdate } from './report-scheduler-mapper';
import type { ScheduledReportDbRow } from './report-scheduler-mapper';

export class ReportSchedulerService {
  private db: D1Database;
  constructor(env: Bindings) { this.db = env.DB; }

  async createScheduledReport(config: Omit<ScheduledReport, 'id' | 'createdAt' | 'nextRun'>, userId: string): Promise<ScheduledReport> {
    try {
      const id = crypto.randomUUID();
      const now = nowISO();
      const nextRun = this.calculateNextRun(config.schedule);
      const report: ScheduledReport = { ...config, id, createdBy: userId, createdAt: now, nextRun };
      const { drizzle } = await import('drizzle-orm/d1');
      const { scheduledReports } = await import('../../../db/schema');
      await drizzle(this.db).insert(scheduledReports).values(toDbRow(report) as typeof scheduledReports.$inferInsert);
      return report;
    } catch (error) {
      logger.error('Create scheduled report error', 'ReportScheduler', undefined, error instanceof Error ? error : String(error));
      throw new ReportGenerationError('Failed to create scheduled report');
    }
  }

  async updateScheduledReport(id: string, updates: Partial<ScheduledReport>, userId: string): Promise<ScheduledReport> {
    try {
      const { drizzle } = await import('drizzle-orm/d1');
      const { scheduledReports } = await import('../../../db/schema');
      const { eq, and, isNull } = await import('drizzle-orm');
      const db = drizzle(this.db);
      const existing = await db.select().from(scheduledReports).where(and(eq(scheduledReports.id, id), isNull(scheduledReports.deletedAt))).get() as ScheduledReportDbRow | undefined;
      if (!existing) throw new ReportGenerationError('Scheduled report not found');
      if (existing.createdBy !== userId) throw new ReportGenerationError('Not authorized to update this scheduled report');
      const newSchedule = updates.schedule ?? fromDbRow(existing).schedule;
      const nextExec = updates.schedule ? this.calculateNextRun(newSchedule) : undefined;
      const patch = toDbUpdate(updates, nextExec);
      patch.updatedAt = nowISO();
      await db.update(scheduledReports).set(patch).where(eq(scheduledReports.id, id));
      const updated = await db.select().from(scheduledReports).where(eq(scheduledReports.id, id)).get() as ScheduledReportDbRow | undefined;
      if (!updated) throw new ReportGenerationError('Failed to fetch updated scheduled report');
      return fromDbRow(updated);
    } catch (error) {
      if (error instanceof ReportGenerationError) throw error;
      logger.error('Update scheduled report error', 'ReportScheduler', undefined, error instanceof Error ? error : String(error));
      throw new ReportGenerationError('Failed to update scheduled report');
    }
  }

  async deleteScheduledReport(id: string, userId: string): Promise<boolean> {
    try {
      const { drizzle } = await import('drizzle-orm/d1');
      const { scheduledReports } = await import('../../../db/schema');
      const { eq, and, isNull } = await import('drizzle-orm');
      const db = drizzle(this.db);
      const existing = await db.select({ id: scheduledReports.id, createdBy: scheduledReports.createdBy }).from(scheduledReports).where(and(eq(scheduledReports.id, id), isNull(scheduledReports.deletedAt))).get();
      if (!existing) return false;
      if (existing.createdBy !== userId) throw new ReportGenerationError('Not authorized to delete this scheduled report');
      await db.update(scheduledReports).set({ deletedAt: nowISO(), isActive: false }).where(eq(scheduledReports.id, id));
      return true;
    } catch (error) {
      if (error instanceof ReportGenerationError) throw error;
      logger.error('Delete scheduled report error', 'ReportScheduler', undefined, error instanceof Error ? error : String(error));
      return false;
    }
  }

  async listScheduledReports(userId?: string): Promise<ScheduledReport[]> {
    try {
      const { drizzle } = await import('drizzle-orm/d1');
      const { scheduledReports } = await import('../../../db/schema');
      const { eq, and, isNull, asc } = await import('drizzle-orm');
      const db = drizzle(this.db);
      const conds = [isNull(scheduledReports.deletedAt)];
      if (userId) conds.push(eq(scheduledReports.createdBy, userId));
      const rows = await db.select().from(scheduledReports).where(and(...conds)).orderBy(asc(scheduledReports.nextExecutionAt)).all() as ScheduledReportDbRow[];
      return rows.map(fromDbRow);
    } catch (error) {
      logger.error('List scheduled reports error', 'ReportScheduler', undefined, error instanceof Error ? error : String(error));
      return [];
    }
  }

  async getScheduledReport(id: string): Promise<ScheduledReport | null> {
    try {
      const { drizzle } = await import('drizzle-orm/d1');
      const { scheduledReports } = await import('../../../db/schema');
      const { eq, and, isNull } = await import('drizzle-orm');
      const db = drizzle(this.db);
      const row = await db.select().from(scheduledReports).where(and(eq(scheduledReports.id, id), isNull(scheduledReports.deletedAt))).get() as ScheduledReportDbRow | undefined;
      return row ? fromDbRow(row) : null;
    } catch (error) {
      logger.error('Get scheduled report error', 'ReportScheduler', undefined, error instanceof Error ? error : String(error));
      return null;
    }
  }

  calculateNextRun(schedule: ScheduledReport['schedule']): string {
    const now = new Date();
    const [hour, minute] = schedule.time.split(':').map(Number);
    const nextRun = new Date(now);
    nextRun.setHours(hour, minute, 0, 0);
    switch (schedule.frequency) {
      case 'daily': if (nextRun <= now) nextRun.setDate(nextRun.getDate() + 1); break;
      case 'weekly': { const t = schedule.dayOfWeek || 1; let d = t - nextRun.getDay(); if (d <= 0 || (d === 0 && nextRun <= now)) d += 7; nextRun.setDate(nextRun.getDate() + d); break; }
      case 'monthly': { nextRun.setDate(schedule.dayOfMonth || 1); if (nextRun <= now) nextRun.setMonth(nextRun.getMonth() + 1); break; }
      case 'quarterly': { const q = Math.floor(nextRun.getMonth() / 3); nextRun.setMonth(q * 3, 1); if (nextRun <= now) nextRun.setMonth((q + 1) * 3, 1); break; }
    }
    return nextRun.toISOString();
  }

  async processScheduledReports(): Promise<{ processed: number; succeeded: number; failed: number }> {
    const stats = { processed: 0, succeeded: 0, failed: 0 };
    try {
      const { drizzle } = await import('drizzle-orm/d1');
      const { scheduledReports, scheduledReportExecutions } = await import('../../../db/schema');
      const { eq, and, isNull, lte, sql } = await import('drizzle-orm');
      const db = drizzle(this.db);
      const now = nowISO();
      const dueReports = await db.select().from(scheduledReports).where(and(eq(scheduledReports.isActive, true), isNull(scheduledReports.deletedAt), lte(scheduledReports.nextExecutionAt, now))).all() as ScheduledReportDbRow[];
      if (dueReports.length === 0) return stats;
      logger.info(`Processing ${dueReports.length} scheduled reports`, 'ReportScheduler');
      const { ReportGeneratorService } = await import('./report-generator-service');
      const { ReportUtils } = await import('./report-utils');
      const env = { DB: this.db } as any;
      const generator = new ReportGeneratorService(env);
      const utils = new ReportUtils(this.db);
      for (const dbRow of dueReports) {
        stats.processed++;
        const sr = fromDbRow(dbRow);
        const execId = crypto.randomUUID();
        const execStart = nowISO();
        await db.insert(scheduledReportExecutions).values({ id: execId, scheduledReportId: dbRow.id, executionStartedAt: execStart, executionStatus: 'running', retryCount: 0 });
        try {
          const generated = await generator.generateReport({ type: sr.type, title: `${sr.name} - ${new Date().toISOString().split('T')[0]}`, format: sr.format, timeRange: 'last_24_hours', filters: sr.filters as Record<string, string | string[]>, options: sr.options as Record<string, boolean | string | number> }, dbRow.createdBy, utils);
          const done = nowISO();
          const dur = new Date(done).getTime() - new Date(execStart).getTime();
          await db.update(scheduledReportExecutions).set({ executionStatus: 'success', executionCompletedAt: done, executionDuration: Math.round(dur / 1000), generatedReportId: generated.id }).where(eq(scheduledReportExecutions.id, execId));
          await db.update(scheduledReports).set({ nextExecutionAt: this.calculateNextRun(sr.schedule), lastExecutionAt: done, lastExecutionStatus: 'success', executionCount: sql`COALESCE(${scheduledReports.executionCount}, 0) + 1`, updatedAt: done }).where(eq(scheduledReports.id, dbRow.id));
          stats.succeeded++;
        } catch (error) {
          const failedAt = nowISO();
          const retries = dbRow.executionCount ?? 0;
          const max = dbRow.maxRetries ?? 3;
          await db.update(scheduledReportExecutions).set({ executionStatus: 'failed', executionCompletedAt: failedAt, errorMessage: error instanceof Error ? error.message : String(error), retryCount: retries + 1 }).where(eq(scheduledReportExecutions.id, execId));
          if (retries + 1 >= max) {
            await db.update(scheduledReports).set({ isActive: false, lastExecutionStatus: 'failed', updatedAt: failedAt }).where(eq(scheduledReports.id, dbRow.id));
          } else {
            const delay = (dbRow.retryDelayMinutes ?? 30) * 60 * 1000;
            await db.update(scheduledReports).set({ nextExecutionAt: new Date(Date.now() + delay).toISOString(), lastExecutionStatus: 'failed', updatedAt: failedAt }).where(eq(scheduledReports.id, dbRow.id));
          }
          stats.failed++;
          logger.error(`Scheduled report ${dbRow.id} failed`, 'ReportScheduler', undefined, error instanceof Error ? error : String(error));
        }
      }
    } catch (error) {
      logger.error('processScheduledReports failed', 'ReportScheduler', undefined, error instanceof Error ? error : String(error));
    }
    return stats;
  }
}
