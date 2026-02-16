// Report Scheduler Service
// Handles scheduled report creation, management and execution

import type { Bindings } from '@/types';
import type { ScheduledReport } from '../types/report-types';
import { ReportGenerationError } from '../types/report-types';

/**
 * Handles scheduled report CRUD and next-run calculations
 */
export class ReportSchedulerService {
  private db: D1Database;
  private env: Bindings;

  constructor(env: Bindings) {
    this.db = env.DB;
    this.env = env;
  }

  /**
   * Create a scheduled report
   */
  async createScheduledReport(
    config: Omit<ScheduledReport, 'id' | 'createdAt' | 'nextRun'>,
    userId: string
  ): Promise<ScheduledReport> {
    try {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const nextRun = this.calculateNextRun(config.schedule);

      const scheduledReport: ScheduledReport = {
        ...config,
        id,
        createdBy: userId,
        createdAt: now,
        nextRun
      };

      // TODO: Save to database
      // await this.saveScheduledReport(scheduledReport);

      return scheduledReport;
    } catch (error) {
      console.error('Create scheduled report error:', error);
      throw new ReportGenerationError('Failed to create scheduled report');
    }
  }

  /**
   * Update a scheduled report
   */
  async updateScheduledReport(
    id: string,
    updates: Partial<ScheduledReport>,
    userId: string
  ): Promise<ScheduledReport> {
    try {
      // TODO: Fetch existing from database

      const updatedReport: ScheduledReport = {
        id,
        name: updates.name || 'Updated Report',
        type: updates.type || 'conversation_summary',
        format: updates.format || 'excel',
        schedule: updates.schedule || { frequency: 'daily', time: '09:00' },
        filters: updates.filters || {},
        options: updates.options || {},
        recipients: updates.recipients || [],
        isActive: updates.isActive !== undefined ? updates.isActive : true,
        createdBy: userId,
        createdAt: new Date().toISOString(),
        nextRun: this.calculateNextRun(updates.schedule || { frequency: 'daily', time: '09:00' })
      };

      // TODO: Update in database

      return updatedReport;
    } catch (error) {
      console.error('Update scheduled report error:', error);
      throw new ReportGenerationError('Failed to update scheduled report');
    }
  }

  /**
   * Delete a scheduled report
   */
  async deleteScheduledReport(_id: string, _userId: string): Promise<boolean> {
    try {
      // TODO: Check permissions and delete
      return true;
    } catch (error) {
      console.error('Delete scheduled report error:', error);
      return false;
    }
  }

  /**
   * List scheduled reports
   */
  async listScheduledReports(userId?: string): Promise<ScheduledReport[]> {
    try {
      // TODO: Query from database
      const mockReports: ScheduledReport[] = [
        {
          id: '1',
          name: '每日對話摘要',
          type: 'conversation_summary',
          format: 'excel',
          schedule: { frequency: 'daily', time: '09:00' },
          filters: {},
          options: { includeCharts: true, includeSummary: true },
          recipients: [
            { email: 'manager@company.com', name: 'Manager', role: 'team' }
          ],
          isActive: true,
          createdBy: userId || 'admin',
          createdAt: '2025-09-01T00:00:00.000Z',
          nextRun: '2025-09-26T09:00:00.000Z'
        }
      ];

      return mockReports;
    } catch (error) {
      console.error('List scheduled reports error:', error);
      return [];
    }
  }

  /**
   * Calculate next run time for a schedule
   */
  calculateNextRun(schedule: ScheduledReport['schedule']): string {
    const now = new Date();
    const [hour, minute] = schedule.time.split(':').map(Number);

    let nextRun = new Date(now);
    nextRun.setHours(hour, minute, 0, 0);

    switch (schedule.frequency) {
      case 'daily':
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
        break;
      case 'weekly': {
        const targetDay = schedule.dayOfWeek || 1;
        const currentDay = nextRun.getDay();
        let daysToAdd = targetDay - currentDay;
        if (daysToAdd <= 0 || (daysToAdd === 0 && nextRun <= now)) {
          daysToAdd += 7;
        }
        nextRun.setDate(nextRun.getDate() + daysToAdd);
        break;
      }
      case 'monthly': {
        const targetDate = schedule.dayOfMonth || 1;
        nextRun.setDate(targetDate);
        if (nextRun <= now) {
          nextRun.setMonth(nextRun.getMonth() + 1);
        }
        break;
      }
      case 'quarterly': {
        const currentQuarter = Math.floor(nextRun.getMonth() / 3);
        nextRun.setMonth(currentQuarter * 3, 1);
        if (nextRun <= now) {
          nextRun.setMonth((currentQuarter + 1) * 3, 1);
        }
        break;
      }
    }

    return nextRun.toISOString();
  }
}
