// Customer 統計服務
// 提供客戶數據統計和分析功能

import { eq, and, desc, sql, count, gte } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import {
  customers,
  customerTags,
  tags,
  teams,
  conversations,
  messages
} from '@/db/schema';
import {
  CustomerStats,
  CustomerStatsResponse
} from '../types/customer-types';
import type { JWTPayload } from '@/types';

export class CustomerStatsService {
  private drizzleDb: ReturnType<typeof drizzle>;

  constructor(private db: D1Database) {
    this.drizzleDb = drizzle(db);
  }

  // ======================== 基礎統計 ========================

  /**
   * 獲取客戶統計概覽
   */
  async getCustomerStats(userPayload?: JWTPayload): Promise<CustomerStats> {
    try {
      // 建立基礎權限條件
      const baseConditions = this.buildPermissionConditions(userPayload);
      const baseCondition = baseConditions.length > 0 ? and(...baseConditions) : undefined;

      // 並行執行所有統計查詢
      const [
        totalResult,
        platformStats,
        teamStats,
        taggedResult,
        emailResult,
        phoneResult,
        recentActiveResult
      ] = await Promise.all([
        this.getTotalCustomers(baseCondition),
        this.getPlatformStats(baseCondition),
        this.getTeamStats(baseCondition),
        this.getTaggedCustomersCount(baseCondition),
        this.getCustomersWithEmailCount(baseCondition),
        this.getCustomersWithPhoneCount(baseCondition),
        this.getRecentActiveCustomersCount(baseCondition)
      ]);

      // 組織統計數據
      const stats: CustomerStats = {
        total: totalResult,
        byPlatform: {},
        byTeam: {},
        withTags: taggedResult,
        withEmail: emailResult,
        withPhone: phoneResult,
        recentActive: recentActiveResult
      };

      // 組織平台統計
      platformStats.forEach(row => {
        stats.byPlatform[row.platform] = row.count;
      });

      // 組織團隊統計
      teamStats.forEach(row => {
        stats.byTeam[row.teamName] = row.count;
      });

      return stats;
    } catch (error) {
      console.error('Error getting customer stats:', error);
      throw error;
    }
  }

  // ======================== 詳細統計 ========================

  /**
   * 獲取平台分佈統計
   */
  async getPlatformDistribution(userPayload?: JWTPayload): Promise<Record<string, number>> {
    try {
      const baseConditions = this.buildPermissionConditions(userPayload);
      const baseCondition = baseConditions.length > 0 ? and(...baseConditions) : undefined;

      const platformStats = await this.getPlatformStats(baseCondition);

      const distribution: Record<string, number> = {};
      platformStats.forEach(row => {
        distribution[row.platform] = row.count;
      });

      return distribution;
    } catch (error) {
      console.error('Error getting platform distribution:', error);
      throw error;
    }
  }

  /**
   * 獲取團隊分佈統計
   */
  async getTeamDistribution(userPayload?: JWTPayload): Promise<Record<string, number>> {
    try {
      const baseConditions = this.buildPermissionConditions(userPayload);
      const baseCondition = baseConditions.length > 0 ? and(...baseConditions) : undefined;

      const teamStats = await this.getTeamStats(baseCondition);

      const distribution: Record<string, number> = {};
      teamStats.forEach(row => {
        distribution[row.teamName] = row.count;
      });

      return distribution;
    } catch (error) {
      console.error('Error getting team distribution:', error);
      throw error;
    }
  }

  /**
   * 獲取活躍度統計
   */
  async getActivityStats(userPayload?: JWTPayload, days: number = 30): Promise<{
    totalActive: number;
    dailyActive: Record<string, number>;
    topActiveCustomers: Array<{ customerId: number; displayName: string; messageCount: number; }>;
  }> {
    try {
      const baseConditions = this.buildPermissionConditions(userPayload);

      // 獲取指定天數內活躍的客戶總數
      const activeConditions = [...baseConditions];
      activeConditions.push(
        gte(messages.createdAt, sql`datetime('now', '-${days} days')`),
        eq(messages.senderType, 'customer')
      );

      const totalActiveResult = await this.drizzleDb
        .select({ count: sql<number>`COUNT(DISTINCT ${customers.id})` })
        .from(customers)
        .innerJoin(conversations, eq(customers.id, conversations.customerId))
        .innerJoin(messages, eq(conversations.id, messages.conversationId))
        .where(and(...activeConditions))
        .get();

      // 獲取每日活躍度 (最近7天)
      const dailyActiveResult = await this.drizzleDb
        .select({
          date: sql<string>`date(${messages.createdAt})`,
          count: sql<number>`COUNT(DISTINCT ${customers.id})`
        })
        .from(customers)
        .innerJoin(conversations, eq(customers.id, conversations.customerId))
        .innerJoin(messages, eq(conversations.id, messages.conversationId))
        .where(and(
          ...baseConditions,
          gte(messages.createdAt, sql`datetime('now', '-7 days')`),
          eq(messages.senderType, 'customer')
        ))
        .groupBy(sql`date(${messages.createdAt})`)
        .orderBy(sql`date(${messages.createdAt})`)
        .all();

      // 獲取最活躍的客戶 (前10名)
      const topActiveResult = await this.drizzleDb
        .select({
          customerId: customers.id,
          displayName: customers.displayName,
          messageCount: sql<number>`COUNT(${messages.id})`
        })
        .from(customers)
        .innerJoin(conversations, eq(customers.id, conversations.customerId))
        .innerJoin(messages, eq(conversations.id, messages.conversationId))
        .where(and(
          ...baseConditions,
          gte(messages.createdAt, sql`datetime('now', '-${days} days')`),
          eq(messages.senderType, 'customer')
        ))
        .groupBy(customers.id)
        .orderBy(desc(sql`COUNT(${messages.id})`))
        .limit(10)
        .all();

      // 組織日活躍度數據
      const dailyActive: Record<string, number> = {};
      dailyActiveResult.forEach(row => {
        dailyActive[row.date] = row.count;
      });

      // 組織最活躍客戶數據
      const topActiveCustomers = topActiveResult.map(row => ({
        customerId: row.customerId,
        displayName: row.displayName || `Customer ${row.customerId}`,
        messageCount: row.messageCount
      }));

      return {
        totalActive: totalActiveResult?.count || 0,
        dailyActive,
        topActiveCustomers
      };
    } catch (error) {
      console.error('Error getting activity stats:', error);
      throw error;
    }
  }

  /**
   * 獲取增長趨勢統計
   */
  async getGrowthStats(userPayload?: JWTPayload, months: number = 12): Promise<{
    monthlyGrowth: Record<string, number>;
    totalGrowth: number;
    averageMonthlyGrowth: number;
  }> {
    try {
      const baseConditions = this.buildPermissionConditions(userPayload);

      // 獲取月度新增客戶統計
      const monthlyGrowthResult = await this.drizzleDb
        .select({
          month: sql<string>`strftime('%Y-%m', ${customers.createdAt})`,
          count: sql<number>`COUNT(*)`
        })
        .from(customers)
        .where(and(
          ...baseConditions,
          gte(customers.createdAt, sql`datetime('now', '-${months} months')`)
        ))
        .groupBy(sql`strftime('%Y-%m', ${customers.createdAt})`)
        .orderBy(sql`strftime('%Y-%m', ${customers.createdAt})`)
        .all();

      // 組織月度數據
      const monthlyGrowth: Record<string, number> = {};
      let totalGrowth = 0;

      monthlyGrowthResult.forEach(row => {
        monthlyGrowth[row.month] = row.count;
        totalGrowth += row.count;
      });

      const averageMonthlyGrowth = monthlyGrowthResult.length > 0
        ? totalGrowth / monthlyGrowthResult.length
        : 0;

      return {
        monthlyGrowth,
        totalGrowth,
        averageMonthlyGrowth: Math.round(averageMonthlyGrowth * 100) / 100
      };
    } catch (error) {
      console.error('Error getting growth stats:', error);
      throw error;
    }
  }

  // ======================== 私有輔助方法 ========================

  /**
   * 建立權限條件
   */
  private buildPermissionConditions(userPayload?: JWTPayload) {
    const conditions = [];

    // 非admin用戶只能看到自己團隊的統計
    if (userPayload?.role !== 'admin' && userPayload?.teamId) {
      conditions.push(
        sql`(${customers.sourceTeamId} = ${userPayload.teamId} OR ${customers.sourceTeamId} IS NULL)`
      );
    }

    // 排除已刪除的客戶
    conditions.push(
      sql`(${customers.metadata} IS NULL OR ${customers.metadata} NOT LIKE '%"_deleted":true%')`
    );

    return conditions;
  }

  /**
   * 獲取客戶總數
   */
  private async getTotalCustomers(baseCondition?: any): Promise<number> {
    const result = await this.drizzleDb
      .select({ total: count(customers.id) })
      .from(customers)
      .where(baseCondition)
      .get();

    return result?.total || 0;
  }

  /**
   * 獲取平台統計
   */
  private async getPlatformStats(baseCondition?: any): Promise<Array<{ platform: string; count: number; }>> {
    return await this.drizzleDb
      .select({
        platform: customers.platform,
        count: count(customers.id)
      })
      .from(customers)
      .where(baseCondition)
      .groupBy(customers.platform)
      .all();
  }

  /**
   * 獲取團隊統計
   */
  private async getTeamStats(baseCondition?: any): Promise<Array<{ teamName: string; count: number; }>> {
    return await this.drizzleDb
      .select({
        teamName: sql<string>`COALESCE(${teams.name}, '未分配')`,
        count: count(customers.id)
      })
      .from(customers)
      .leftJoin(teams, eq(customers.sourceTeamId, teams.id))
      .where(baseCondition)
      .groupBy(customers.sourceTeamId, teams.name)
      .all();
  }

  /**
   * 獲取有標籤的客戶數量
   */
  private async getTaggedCustomersCount(baseCondition?: any): Promise<number> {
    const result = await this.drizzleDb
      .select({ count: sql<number>`COUNT(DISTINCT ${customers.id})` })
      .from(customers)
      .innerJoin(customerTags, eq(customers.id, customerTags.customerId))
      .where(baseCondition)
      .get();

    return result?.count || 0;
  }

  /**
   * 獲取有Email的客戶數量
   */
  private async getCustomersWithEmailCount(baseCondition?: any): Promise<number> {
    const conditions = baseCondition ? [baseCondition] : [];
    conditions.push(sql`${customers.email} IS NOT NULL AND ${customers.email} != ''`);

    const result = await this.drizzleDb
      .select({ count: count(customers.id) })
      .from(customers)
      .where(and(...conditions))
      .get();

    return result?.count || 0;
  }

  /**
   * 獲取有電話的客戶數量
   */
  private async getCustomersWithPhoneCount(baseCondition?: any): Promise<number> {
    const conditions = baseCondition ? [baseCondition] : [];
    conditions.push(sql`${customers.phone} IS NOT NULL AND ${customers.phone} != ''`);

    const result = await this.drizzleDb
      .select({ count: count(customers.id) })
      .from(customers)
      .where(and(...conditions))
      .get();

    return result?.count || 0;
  }

  /**
   * 獲取最近活躍的客戶數量 (最近7天)
   */
  private async getRecentActiveCustomersCount(baseCondition?: any): Promise<number> {
    const conditions = baseCondition ? [baseCondition] : [];
    conditions.push(
      gte(messages.createdAt, sql`datetime('now', '-7 days')`),
      eq(messages.senderType, 'customer')
    );

    const result = await this.drizzleDb
      .select({ count: sql<number>`COUNT(DISTINCT ${customers.id})` })
      .from(customers)
      .innerJoin(conversations, eq(customers.id, conversations.customerId))
      .innerJoin(messages, eq(conversations.id, messages.conversationId))
      .where(and(...conditions))
      .get();

    return result?.count || 0;
  }
}