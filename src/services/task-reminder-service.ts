// src/services/task-reminder-service.ts
// 任務提醒服務 - CRUD 操作與排程處理

import { createDbClient } from '../db/drizzle-factory';
import { taskReminders, type TaskReminder } from '../db/schema';
import { eq, and, lte } from 'drizzle-orm';
import { triggerTaskReminderNotification } from '../utils/notification-trigger';
import type { Bindings } from '../types';
import { nowISO, nowMs } from '@/utils/timestamp'

/**
 * 創建任務提醒的請求參數
 */
export interface CreateTaskReminderRequest {
  userId: string;
  title: string;
  content?: string;
  remindAt: Date | string;
  conversationId?: string;
  repeatType?: 'none' | 'daily' | 'weekly' | 'monthly';
  repeatInterval?: number;
}

/**
 * 更新任務提醒的請求參數
 */
export interface UpdateTaskReminderRequest {
  title?: string;
  content?: string;
  remindAt?: Date | string;
  repeatType?: 'none' | 'daily' | 'weekly' | 'monthly';
  repeatInterval?: number;
}

/**
 * 任務提醒服務
 */
export class TaskReminderService {
  private db: ReturnType<typeof createDbClient>;
  private env: Bindings;

  constructor(database: D1Database, env: Bindings) {
    this.db = createDbClient(database);
    this.env = env;
  }

  /**
   * 創建新的任務提醒
   */
  async create(request: CreateTaskReminderRequest): Promise<string> {
    const reminderId = `reminder_${nowMs()}_${Math.random().toString(36).substr(2, 9)}`;

    const remindAt = request.remindAt instanceof Date
      ? request.remindAt.toISOString()
      : request.remindAt;

    await this.db.insert(taskReminders).values({
      id: reminderId,
      userId: request.userId,
      title: request.title,
      content: request.content || null,
      remindAt,
      conversationId: request.conversationId || null,
      repeatType: request.repeatType || 'none',
      repeatInterval: request.repeatInterval || 0,
      isCompleted: false,
      isSent: false,
      createdAt: nowISO()
    });

    console.log('✅ [TaskReminder] Created:', {
      reminderId,
      userId: request.userId,
      title: request.title,
      remindAt
    });

    return reminderId;
  }

  /**
   * 獲取用戶的所有任務提醒
   */
  async getByUserId(userId: string, includeCompleted: boolean = false): Promise<TaskReminder[]> {
    const conditions = [eq(taskReminders.userId, userId)];

    if (!includeCompleted) {
      conditions.push(eq(taskReminders.isCompleted, false));
    }

    const results = await this.db
      .select()
      .from(taskReminders)
      .where(and(...conditions))
      .orderBy(taskReminders.remindAt);

    return results;
  }

  /**
   * 獲取單個任務提醒
   */
  async getById(id: string, userId: string): Promise<TaskReminder | null> {
    const result = await this.db
      .select()
      .from(taskReminders)
      .where(and(
        eq(taskReminders.id, id),
        eq(taskReminders.userId, userId)
      ))
      .get();

    return result || null;
  }

  /**
   * 更新任務提醒
   */
  async update(id: string, userId: string, updates: UpdateTaskReminderRequest): Promise<boolean> {
    const updateData: any = {};

    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.content !== undefined) updateData.content = updates.content;
    if (updates.remindAt !== undefined) {
      updateData.remindAt = updates.remindAt instanceof Date
        ? updates.remindAt.toISOString()
        : updates.remindAt;
      // 如果更新了提醒時間，重置發送狀態
      updateData.isSent = false;
    }
    if (updates.repeatType !== undefined) updateData.repeatType = updates.repeatType;
    if (updates.repeatInterval !== undefined) updateData.repeatInterval = updates.repeatInterval;

    const result = await this.db
      .update(taskReminders)
      .set(updateData)
      .where(and(
        eq(taskReminders.id, id),
        eq(taskReminders.userId, userId)
      ));

    return (result as any).changes > 0;
  }

  /**
   * 標記任務提醒為已完成
   */
  async markComplete(id: string, userId: string): Promise<boolean> {
    const result = await this.db
      .update(taskReminders)
      .set({
        isCompleted: true,
        completedAt: nowISO()
      })
      .where(and(
        eq(taskReminders.id, id),
        eq(taskReminders.userId, userId)
      ));

    return (result as any).changes > 0;
  }

  /**
   * 刪除任務提醒
   */
  async delete(id: string, userId: string): Promise<boolean> {
    const result = await this.db
      .delete(taskReminders)
      .where(and(
        eq(taskReminders.id, id),
        eq(taskReminders.userId, userId)
      ));

    return (result as any).changes > 0;
  }

  /**
   * 處理到期的任務提醒 (由 Cron Job 調用)
   * 返回處理的提醒數量
   */
  async processDueReminders(): Promise<number> {
    const now = nowISO();

    // 查詢所有到期但未發送的提醒
    const dueReminders = await this.db
      .select()
      .from(taskReminders)
      .where(and(
        lte(taskReminders.remindAt, now),
        eq(taskReminders.isCompleted, false),
        eq(taskReminders.isSent, false)
      ))
      .all();

    if (dueReminders.length === 0) {
      return 0;
    }

    console.log(`🔔 [TaskReminder] Processing ${dueReminders.length} due reminders`);

    let processedCount = 0;

    for (const reminder of dueReminders) {
      try {
        // 觸發通知
        await triggerTaskReminderNotification(this.env, {
          userId: reminder.userId,
          reminderId: reminder.id,
          title: reminder.title,
          content: reminder.content || '',
          conversationId: reminder.conversationId || undefined
        });

        // 標記為已發送
        await this.db
          .update(taskReminders)
          .set({
            isSent: true,
            sentAt: nowISO()
          })
          .where(eq(taskReminders.id, reminder.id));

        // 如果是重複提醒，創建下一個
        if (reminder.repeatType && reminder.repeatType !== 'none') {
          await this.scheduleNextReminder(reminder);
        }

        processedCount++;
      } catch (error) {
        console.error(`⚠️ [TaskReminder] Failed to process reminder ${reminder.id}:`, error);
      }
    }

    console.log(`✅ [TaskReminder] Processed ${processedCount}/${dueReminders.length} reminders`);

    return processedCount;
  }

  /**
   * 創建重複提醒的下一個實例
   */
  private async scheduleNextReminder(reminder: TaskReminder): Promise<void> {
    const currentRemindAt = new Date(reminder.remindAt);
    let nextRemindAt: Date;

    switch (reminder.repeatType) {
      case 'daily':
        nextRemindAt = new Date(currentRemindAt.getTime() + (reminder.repeatInterval || 1) * 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        nextRemindAt = new Date(currentRemindAt.getTime() + (reminder.repeatInterval || 1) * 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        nextRemindAt = new Date(currentRemindAt);
        nextRemindAt.setMonth(nextRemindAt.getMonth() + (reminder.repeatInterval || 1));
        break;
      default:
        return; // 不重複
    }

    await this.create({
      userId: reminder.userId,
      title: reminder.title,
      content: reminder.content || undefined,
      remindAt: nextRemindAt,
      conversationId: reminder.conversationId || undefined,
      repeatType: reminder.repeatType as any,
      repeatInterval: reminder.repeatInterval || 1
    });

    console.log(`🔄 [TaskReminder] Scheduled next reminder for ${nextRemindAt.toISOString()}`);
  }

  /**
   * 獲取即將到期的提醒 (未來 N 分鐘內)
   */
  async getUpcomingReminders(userId: string, minutesAhead: number = 30): Promise<TaskReminder[]> {
    const now = new Date();
    const futureTime = new Date(now.getTime() + minutesAhead * 60 * 1000);

    const results = await this.db
      .select()
      .from(taskReminders)
      .where(and(
        eq(taskReminders.userId, userId),
        eq(taskReminders.isCompleted, false),
        eq(taskReminders.isSent, false),
        lte(taskReminders.remindAt, futureTime.toISOString())
      ))
      .orderBy(taskReminders.remindAt);

    return results;
  }

  /**
   * 獲取用戶的提醒統計
   */
  async getStats(userId: string): Promise<{
    total: number;
    pending: number;
    completed: number;
    overdue: number;
  }> {
    const now = nowISO();
    const allReminders = await this.getByUserId(userId, true);

    const stats = {
      total: allReminders.length,
      pending: 0,
      completed: 0,
      overdue: 0
    };

    for (const reminder of allReminders) {
      if (reminder.isCompleted) {
        stats.completed++;
      } else if (reminder.remindAt < now && !reminder.isSent) {
        stats.overdue++;
      } else {
        stats.pending++;
      }
    }

    return stats;
  }
}
