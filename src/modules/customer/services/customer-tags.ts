// Customer 標籤服務
// 提供客戶標籤管理功能

import { drizzle } from 'drizzle-orm/d1';
import { eq, and, inArray, desc, sql } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import {
  customers,
  customerTags,
  tags
} from '@/db/schema';
import {
  CustomerTag,
  CustomerTagAssignment,
  CustomerTagOperation,
  CustomerNotFoundError
} from '../types/customer-types';
import type { JWTPayload } from '@/types';

export class CustomerTagService {
  private drizzleDb: ReturnType<typeof drizzle>;

  constructor(private db: D1Database) {
    this.drizzleDb = drizzle(db);
  }

  // ======================== 標籤查詢 ========================

  /**
   * 獲取客戶的所有標籤
   */
  async getCustomerTags(customerId: number): Promise<CustomerTag[]> {
    try {
      // 檢查客戶是否存在
      const customer = await this.drizzleDb
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.id, customerId))
        .get();

      if (!customer) {
        throw new CustomerNotFoundError(customerId);
      }

      // 查詢客戶標籤
      const customerTagsData = await this.drizzleDb
        .select({
          id: tags.id,
          name: tags.name,
          color: tags.color
        })
        .from(customerTags)
        .innerJoin(tags, eq(customerTags.tagId, tags.id))
        .where(eq(customerTags.customerId, customerId))
        .all();

      return customerTagsData.map(tag => ({
        id: tag.id,
        name: tag.name,
        color: tag.color || '#3B82F6'
      }));
    } catch (error) {
      console.error('Error getting customer tags:', error);
      throw error;
    }
  }

  /**
   * 獲取所有可用標籤
   */
  async getAvailableTags(): Promise<CustomerTag[]> {
    try {
      const availableTags = await this.drizzleDb
        .select({
          id: tags.id,
          name: tags.name,
          color: tags.color
        })
        .from(tags)
        .orderBy(tags.name)
        .all();

      return availableTags.map(tag => ({
        id: tag.id,
        name: tag.name,
        color: tag.color || '#3B82F6'
      }));
    } catch (error) {
      console.error('Error getting available tags:', error);
      throw error;
    }
  }

  // ======================== 標籤操作 ========================

  /**
   * 為客戶添加標籤
   */
  async addTagsToCustomer(
    customerId: number,
    tagIds: number[],
    userPayload?: JWTPayload
  ): Promise<void> {
    try {
      // 檢查客戶是否存在
      const customer = await this.drizzleDb
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.id, customerId))
        .get();

      if (!customer) {
        throw new CustomerNotFoundError(customerId);
      }

      // 檢查標籤是否存在
      const existingTags = await this.drizzleDb
        .select({ id: tags.id })
        .from(tags)
        .where(inArray(tags.id, tagIds))
        .all();

      const existingTagIds = existingTags.map(tag => tag.id);
      const invalidTagIds = tagIds.filter(id => !existingTagIds.includes(id));

      if (invalidTagIds.length > 0) {
        throw new Error(`Invalid tag IDs: ${invalidTagIds.join(', ')}`);
      }

      // 查詢已存在的標籤關聯
      const existingAssignments = await this.drizzleDb
        .select({ tagId: customerTags.tagId })
        .from(customerTags)
        .where(and(
          eq(customerTags.customerId, customerId),
          inArray(customerTags.tagId, tagIds)
        ))
        .all();

      const existingAssignmentTagIds = existingAssignments.map(a => a.tagId);
      const newTagIds = tagIds.filter(id => !existingAssignmentTagIds.includes(id));

      // 只添加新的標籤關聯
      if (newTagIds.length > 0) {
        const timestamp = new Date().toISOString();
        const assignedBy = userPayload?.userId ? String(userPayload.userId) : 'system';
        const insertData = newTagIds.map(tagId => ({
          customerId,
          tagId,
          assignedBy,
          assignedAt: timestamp
        }));

        // 批量插入新的標籤關聯
        for (const tagAssignment of insertData) {
          await this.drizzleDb
            .insert(customerTags)
            .values(tagAssignment)
            .run();
        }
      }
    } catch (error) {
      console.error('Error adding tags to customer:', error);
      throw error;
    }
  }

  /**
   * 從客戶移除標籤
   */
  async removeTagsFromCustomer(customerId: number, tagIds: number[]): Promise<void> {
    try {
      // 檢查客戶是否存在
      const customer = await this.drizzleDb
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.id, customerId))
        .get();

      if (!customer) {
        throw new CustomerNotFoundError(customerId);
      }

      // 移除標籤關聯
      await this.drizzleDb
        .delete(customerTags)
        .where(and(
          eq(customerTags.customerId, customerId),
          inArray(customerTags.tagId, tagIds)
        ))
        .run();
    } catch (error) {
      console.error('Error removing tags from customer:', error);
      throw error;
    }
  }

  /**
   * 設置客戶的標籤 (替換所有現有標籤)
   */
  async setCustomerTags(
    customerId: number,
    tagIds: number[],
    userPayload?: JWTPayload
  ): Promise<void> {
    try {
      // 檢查客戶是否存在
      const customer = await this.drizzleDb
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.id, customerId))
        .get();

      if (!customer) {
        throw new CustomerNotFoundError(customerId);
      }

      // 先移除所有現有標籤
      await this.drizzleDb
        .delete(customerTags)
        .where(eq(customerTags.customerId, customerId))
        .run();

      // 如果有新標籤，則添加它們
      if (tagIds.length > 0) {
        await this.addTagsToCustomer(customerId, tagIds, userPayload);
      }
    } catch (error) {
      console.error('Error setting customer tags:', error);
      throw error;
    }
  }

  // ======================== 批量操作 ========================

  /**
   * 批量為多個客戶添加標籤
   */
  async addTagsToMultipleCustomers(
    customerIds: number[],
    tagIds: number[],
    userPayload?: JWTPayload
  ): Promise<{ success: number[]; failed: number[]; }> {
    const results = {
      success: [] as number[],
      failed: [] as number[]
    };

    for (const customerId of customerIds) {
      try {
        await this.addTagsToCustomer(customerId, tagIds, userPayload);
        results.success.push(customerId);
      } catch (error) {
        console.error(`Error adding tags to customer ${customerId}:`, error);
        results.failed.push(customerId);
      }
    }

    return results;
  }

  /**
   * 批量從多個客戶移除標籤
   */
  async removeTagsFromMultipleCustomers(
    customerIds: number[],
    tagIds: number[]
  ): Promise<{ success: number[]; failed: number[]; }> {
    const results = {
      success: [] as number[],
      failed: [] as number[]
    };

    for (const customerId of customerIds) {
      try {
        await this.removeTagsFromCustomer(customerId, tagIds);
        results.success.push(customerId);
      } catch (error) {
        console.error(`Error removing tags from customer ${customerId}:`, error);
        results.failed.push(customerId);
      }
    }

    return results;
  }

  // ======================== 標籤分析 ========================

  /**
   * 獲取標籤使用統計
   */
  async getTagUsageStats(): Promise<Array<{
    tagId: number;
    tagName: string;
    tagColor: string;
    customerCount: number;
  }>> {
    try {
      const tagStats = await this.drizzleDb
        .select({
          tagId: tags.id,
          tagName: tags.name,
          tagColor: tags.color,
          customerCount: sql<number>`COUNT(${customerTags.customerId})`
        })
        .from(tags)
        .leftJoin(customerTags, eq(tags.id, customerTags.tagId))
        .groupBy(tags.id)
        .orderBy(sql`COUNT(${customerTags.customerId}) DESC`)
        .all();

      return tagStats.map(stat => ({
        tagId: stat.tagId,
        tagName: stat.tagName,
        tagColor: stat.tagColor || '#3B82F6',
        customerCount: stat.customerCount || 0
      }));
    } catch (error) {
      console.error('Error getting tag usage stats:', error);
      throw error;
    }
  }

  /**
   * 獲取客戶的標籤歷史 (如果需要追蹤標籤變更歷史)
   */
  async getCustomerTagHistory(customerId: number): Promise<CustomerTagAssignment[]> {
    try {
      // 檢查客戶是否存在
      const customer = await this.drizzleDb
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.id, customerId))
        .get();

      if (!customer) {
        throw new CustomerNotFoundError(customerId);
      }

      // 查詢標籤分配歷史
      const tagHistory = await this.drizzleDb
        .select({
          customerId: customerTags.customerId,
          tagId: customerTags.tagId,
          assignedBy: customerTags.assignedBy,
          assignedAt: customerTags.assignedAt
        })
        .from(customerTags)
        .where(eq(customerTags.customerId, customerId))
        .orderBy(desc(customerTags.assignedAt))
        .all();

      return tagHistory.map(record => ({
        customerId: record.customerId,
        tagId: record.tagId,
        assignedBy: record.assignedBy,
        assignedAt: record.assignedAt || new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error getting customer tag history:', error);
      throw error;
    }
  }

  // ======================== 標籤搜索 ========================

  /**
   * 根據標籤查找客戶
   */
  async findCustomersByTags(tagIds: number[], matchAll: boolean = false): Promise<number[]> {
    try {
      if (matchAll) {
        // 找出擁有所有指定標籤的客戶
        const result = await this.drizzleDb
          .select({
            customerId: customerTags.customerId,
            tagCount: sql<number>`COUNT(DISTINCT ${customerTags.tagId})`
          })
          .from(customerTags)
          .where(inArray(customerTags.tagId, tagIds))
          .groupBy(customerTags.customerId)
          .having(sql`COUNT(DISTINCT ${customerTags.tagId}) = ${tagIds.length}`)
          .all();

        return result.map(r => r.customerId);
      } else {
        // 找出擁有任一指定標籤的客戶
        const result = await this.drizzleDb
          .select({
            customerId: customerTags.customerId
          })
          .from(customerTags)
          .where(inArray(customerTags.tagId, tagIds))
          .groupBy(customerTags.customerId)
          .all();

        return result.map(r => r.customerId);
      }
    } catch (error) {
      console.error('Error finding customers by tags:', error);
      throw error;
    }
  }

  /**
   * 獲取沒有任何標籤的客戶
   */
  async getCustomersWithoutTags(): Promise<number[]> {
    try {
      const result = await this.drizzleDb
        .select({ customerId: customers.id })
        .from(customers)
        .leftJoin(customerTags, eq(customers.id, customerTags.customerId))
        .where(sql`${customerTags.customerId} IS NULL`)
        .all();

      return result.map(r => r.customerId);
    } catch (error) {
      console.error('Error getting customers without tags:', error);
      throw error;
    }
  }
}