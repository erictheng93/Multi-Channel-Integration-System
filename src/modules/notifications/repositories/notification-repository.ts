// src/modules/notifications/repositories/notification-repository.ts
// 通知資料存取層

import { drizzle } from 'drizzle-orm/d1';
import { createContextLogger } from '@/utils/logger'

const log = createContextLogger('NotificationRepository')

import { sql, eq, and, or, desc, count, gte, lte } from 'drizzle-orm';
import { notifications } from '@/db/schema';
import type { DbCompat } from '@/types/db-compat';
import {
  NotificationBase,
  NotificationQuery,
  CreateNotificationRequest,
  NotificationPriority,
  NotificationType
} from '../types';

interface NotificationRow {
  id: string;
  userId?: string | number | null;
  user_id?: string | number | null;
  type: NotificationType;
  title: string;
  content: string;
  data?: string | null;
  priority?: NotificationPriority | null;
  isRead?: boolean | null;
  is_read?: boolean | null;
  readAt?: string | null;
  read_at?: string | null;
  expiresAt?: string | null;
  expires_at?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
  updatedAt?: string | null;
  updated_at?: string | null;
}

export class NotificationRepository {
  private db: DbCompat;

  constructor(database: D1Database) {
    this.db = drizzle(database) as unknown as DbCompat;
  }

  async create(request: CreateNotificationRequest): Promise<string> {
    const notificationId = crypto.randomUUID();

    await this.db.insert(notifications).values({
      id: notificationId,
      userId: request.userId.toString(),
      type: request.type,
      title: request.title,
      content: request.content,
      data: request.data ? JSON.stringify(request.data) : null,
      priority: request.priority || 'normal',
      isRead: false,
      expiresAt: request.expiresAt ? request.expiresAt.toISOString() : null,
      createdAt: sql`datetime('now')`,
      updatedAt: sql`datetime('now')`
    });

    return notificationId;
  }

  async createBulk(requests: CreateNotificationRequest[]): Promise<string[]> {
    const notificationIds: string[] = [];
    const insertValues = requests.map(request => {
      const notificationId = crypto.randomUUID();
      notificationIds.push(notificationId);

      return {
        id: notificationId,
        userId: request.userId.toString(),
        type: request.type,
        title: request.title,
        content: request.content,
        data: request.data ? JSON.stringify(request.data) : null,
        priority: request.priority || 'normal',
        isRead: false,
        expiresAt: request.expiresAt ? request.expiresAt.toISOString() : null,
        createdAt: sql`datetime('now')`,
        updatedAt: sql`datetime('now')`
      };
    });

    // 使用事務處理批量插入
    try {
      await this.db.batch(
        insertValues.map(values =>
          this.db.insert(notifications).values(values)
        )
      );
    } catch (error) {
      // 如果批量插入失敗，嘗試逐一插入
      log.warn('Bulk insert failed, falling back to individual inserts', { error: error instanceof Error ? error.message : String(error) });
      const results = await Promise.allSettled(
        insertValues.map(values =>
          this.db.insert(notifications).values(values)
        )
      );

      const failedIndexes = results
        .map((result, index) => result.status === 'rejected' ? index : null)
        .filter(index => index !== null);

      if (failedIndexes.length > 0) {
        throw new Error(`Failed to create ${failedIndexes.length} out of ${requests.length} notifications`);
      }
    }

    return notificationIds;
  }

  async findById(id: string, userId: string | number): Promise<NotificationBase | null> {
    const result = await this.db
      .select<NotificationRow>()
      .from(notifications)
      .where(and(
        eq(notifications.id, id),
        eq(notifications.userId, userId.toString())
      ))
      .limit(1);

    if (!result || result.length === 0) {
      return null;
    }

    return this.mapToNotification(result[0]);
  }

  async findByQuery(query: NotificationQuery): Promise<{ notifications: NotificationBase[], total: number }> {
    const whereConditions = [eq(notifications.userId, query.userId.toString())];

    // 排除過期通知
    const expiredCondition = or(
      sql`expires_at IS NULL`,
      sql`expires_at > datetime('now')`
    );
    if (expiredCondition) {
      whereConditions.push(expiredCondition);
    }

    // 通知類型篩選
    if (query.type) {
      whereConditions.push(eq(notifications.type, query.type));
    }

    // 已讀狀態篩選
    if (query.isRead !== undefined) {
      whereConditions.push(eq(notifications.isRead, query.isRead));
    }

    // 優先級篩選 (priority field not available in current schema)
    // if (query.priority) {
    // whereConditions.push(eq(notifications.priority, query.priority));
    // }

    // 日期範圍篩選
    if (query.dateFrom) {
      whereConditions.push(gte(notifications.createdAt, query.dateFrom));
    }
    if (query.dateTo) {
      whereConditions.push(lte(notifications.createdAt, query.dateTo));
    }

    // 取得總數
    const countResult = await this.db
      .select<{ total: number }>({ total: count() })
      .from(notifications)
      .where(and(...whereConditions));

    const total = countResult[0]?.total || 0;

    // 取得分頁資料
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const result = await this.db
      .select<NotificationRow>()
      .from(notifications)
      .where(and(...whereConditions))
      .orderBy(desc(notifications.createdAt))
      .limit(pageSize)
      .offset(offset);

    const notificationList = result.map((row) => this.mapToNotification(row));

    return {
      notifications: notificationList,
      total
    };
  }

  async markAsRead(id: string, userId: string | number): Promise<boolean> {
    const result = await this.db
      .update(notifications)
      .set({
        isRead: true,
        readAt: sql`datetime('now')`,
        updatedAt: sql`datetime('now')`
      })
      .where(and(
        eq(notifications.id, id),
        eq(notifications.userId, userId.toString())
      ));

    return (result.changes ?? 0) > 0;
  }

  async markAllAsRead(userId: string | number, type?: NotificationType): Promise<number> {
    const whereConditions = [
      eq(notifications.userId, userId.toString()),
      eq(notifications.isRead, false)
    ];

    if (type) {
      whereConditions.push(eq(notifications.type, type));
    }

    const result = await this.db
      .update(notifications)
      .set({
        isRead: true,
        readAt: sql`datetime('now')`,
        updatedAt: sql`datetime('now')`
      })
      .where(and(...whereConditions));

    return result.changes || 0;
  }

  async delete(id: string, userId: string | number): Promise<boolean> {
    const result = await this.db
      .delete(notifications)
      .where(and(
        eq(notifications.id, id),
        eq(notifications.userId, userId.toString())
      ));

    return (result.changes ?? 0) > 0;
  }

  async deleteExpired(): Promise<number> {
    const result = await this.db
      .delete(notifications)
      .where(sql`expires_at IS NOT NULL AND expires_at <= datetime('now')`);

    return result.changes || 0;
  }

  async getUnreadCount(userId: string | number, type?: NotificationType): Promise<number> {
    const whereConditions = [
      eq(notifications.userId, userId.toString()),
      eq(notifications.isRead, false)
    ];

    // 排除過期通知
    const expiredCondition = or(
      sql`expires_at IS NULL`,
      sql`expires_at > datetime('now')`
    );
    if (expiredCondition) {
      whereConditions.push(expiredCondition);
    }

    if (type) {
      whereConditions.push(eq(notifications.type, type));
    }

    const result = await this.db
      .select<{ count: number }>({ count: count() })
      .from(notifications)
      .where(and(...whereConditions));

    return result[0]?.count || 0;
  }

  async getRecentNotifications(userId: string | number, limit: number = 10): Promise<NotificationBase[]> {
    const result = await this.db
      .select<NotificationRow>()
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId.toString()),
        eq(notifications.isRead, false),
        or(
          sql`expires_at IS NULL`,
          sql`expires_at > datetime('now')`
        )
      ))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);

    return result.map((row) => this.mapToNotification(row));
  }

  async getStatsByUserId(userId: string | number) {
    const result = await this.db.get(sql`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN is_read = FALSE THEN 1 ELSE 0 END) as unread,
        SUM(CASE WHEN type = 'new_message' THEN 1 ELSE 0 END) as messages,
        SUM(CASE WHEN type = 'conversation_assigned' THEN 1 ELSE 0 END) as assignments,
        SUM(CASE WHEN type = 'mention' THEN 1 ELSE 0 END) as mentions,
        SUM(CASE WHEN type = 'system' THEN 1 ELSE 0 END) as system,
        SUM(CASE WHEN priority = 'urgent' AND is_read = FALSE THEN 1 ELSE 0 END) as urgent_unread,
        SUM(CASE WHEN priority = 'high' AND is_read = FALSE THEN 1 ELSE 0 END) as high_unread,
        SUM(CASE WHEN created_at >= date('now', '-24 hours') THEN 1 ELSE 0 END) as today,
        SUM(CASE WHEN created_at >= date('now', '-7 days') THEN 1 ELSE 0 END) as this_week,
        SUM(CASE WHEN created_at >= date('now', '-30 days') THEN 1 ELSE 0 END) as this_month
      FROM notifications
      WHERE user_id = ${userId.toString()} AND (expires_at IS NULL OR expires_at > datetime('now'))
    `);

    return result;
  }

  private mapToNotification(row: NotificationRow): NotificationBase {
    return {
      id: row.id,
      userId: row.userId ?? row.user_id ?? '',  // 保持原始格式，支援字串和數字
      type: row.type,
      title: row.title,
      content: row.content,
      data: row.data ? JSON.parse(row.data) as Record<string, unknown> : undefined,
      priority: row.priority || 'normal',
      isRead: Boolean(row.isRead || row.is_read),
      readAt: row.readAt || row.read_at || undefined,
      expiresAt: row.expiresAt || row.expires_at || undefined,
      createdAt: row.createdAt || row.created_at || '',
      updatedAt: row.updatedAt || row.updated_at || undefined
    };
  }
}
