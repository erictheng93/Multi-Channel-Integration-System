// Customer CRUD 服務
// 提供客戶的基礎增刪改查操作

import { drizzle } from 'drizzle-orm/d1';
import { eq, and, desc, sql } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import {
  customers,
  customerTags,
  tags,
  teams,
  conversations,
  messages
} from '@/db/schema';
import {
  Customer,
  CustomerWithDetails,
  CreateCustomerData,
  UpdateCustomerData,
  CustomerNotFoundError,
  CustomerAlreadyExistsError,
  CustomerMetadata
} from '../types/customer-types';
import type { Bindings } from '@/types';

export class CustomerCrudService {
  private drizzleDb: ReturnType<typeof drizzle>;

  constructor(private db: D1Database) {
    this.drizzleDb = drizzle(db);
  }

  // ======================== 查詢操作 ========================

  /**
   * 根據ID查詢客戶基本資料
   */
  async findById(customerId: number): Promise<Customer | null> {
    try {
      const customer = await this.drizzleDb
        .select()
        .from(customers)
        .where(eq(customers.id, customerId))
        .get();

      if (!customer) {
        return null;
      }

      return {
        id: customer.id,
        platform: customer.platform,
        platformUserId: customer.platformUserId,
        displayName: customer.displayName,
        avatarUrl: customer.avatarUrl,
        email: customer.email,
        phone: customer.phone,
        sourceTeamId: customer.sourceTeamId,
        metadata: customer.metadata,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt
      };
    } catch (error) {
      console.error('Error finding customer by ID:', error);
      throw error;
    }
  }

  /**
   * 根據ID查詢客戶完整資料 (包含關聯數據)
   */
  async findByIdWithDetails(customerId: number): Promise<CustomerWithDetails | null> {
    try {
      // 查詢客戶基本資料
      const customer = await this.drizzleDb
        .select({
          id: customers.id,
          platform: customers.platform,
          platformUserId: customers.platformUserId,
          displayName: customers.displayName,
          avatarUrl: customers.avatarUrl,
          phone: customers.phone,
          email: customers.email,
          sourceTeamId: customers.sourceTeamId,
          metadata: customers.metadata,
          createdAt: customers.createdAt,
          updatedAt: customers.updatedAt,
          teamName: teams.name
        })
        .from(customers)
        .leftJoin(teams, eq(customers.sourceTeamId, teams.id))
        .where(eq(customers.id, customerId))
        .get();

      if (!customer) {
        return null;
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

      // 查詢對話統計
      const conversationStats = await this.getConversationStats(customerId);

      // 查詢最近消息
      const recentMessages = await this.getRecentMessages(customerId, 5);

      return {
        id: customer.id,
        platform: customer.platform,
        platformUserId: customer.platformUserId,
        displayName: customer.displayName,
        avatarUrl: customer.avatarUrl,
        phone: customer.phone,
        email: customer.email,
        sourceTeamId: customer.sourceTeamId,
        metadata: customer.metadata,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        teamName: customer.teamName,
        tags: customerTagsData.map(tag => ({
          id: tag.id,
          name: tag.name,
          color: tag.color || '#3B82F6'
        })),
        conversationStats,
        recentMessages
      };
    } catch (error) {
      console.error('Error finding customer with details:', error);
      throw error;
    }
  }

  /**
   * 根據平台和平台用戶ID查詢客戶
   */
  async findByPlatformId(platform: string, platformUserId: string): Promise<Customer | null> {
    try {
      const customer = await this.drizzleDb
        .select()
        .from(customers)
        .where(and(
          eq(customers.platform, platform),
          eq(customers.platformUserId, platformUserId)
        ))
        .get();

      if (!customer) {
        return null;
      }

      return {
        id: customer.id,
        platform: customer.platform,
        platformUserId: customer.platformUserId,
        displayName: customer.displayName,
        avatarUrl: customer.avatarUrl,
        email: customer.email,
        phone: customer.phone,
        sourceTeamId: customer.sourceTeamId,
        metadata: customer.metadata,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt
      };
    } catch (error) {
      console.error('Error finding customer by platform ID:', error);
      throw error;
    }
  }

  // ======================== 創建操作 ========================

  /**
   * 創建新客戶
   */
  async create(customerData: CreateCustomerData): Promise<Customer> {
    try {
      const timestamp = new Date().toISOString();

      // 檢查是否已存在相同的平台用戶
      const existingCustomer = await this.findByPlatformId(
        customerData.platform,
        customerData.platformUserId
      );

      if (existingCustomer) {
        throw new CustomerAlreadyExistsError(
          customerData.platform,
          customerData.platformUserId
        );
      }

      // 插入新客戶
      const insertData = {
        platform: customerData.platform,
        platformUserId: customerData.platformUserId,
        displayName: customerData.displayName || null,
        avatarUrl: customerData.avatarUrl || null,
        email: customerData.email || null,
        phone: customerData.phone || null,
        sourceTeamId: customerData.sourceTeamId || null,
        metadata: customerData.metadata ? JSON.stringify(customerData.metadata) : null,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      const result = await this.drizzleDb
        .insert(customers)
        .values(insertData)
        .returning({ id: customers.id })
        .get();

      // 返回創建的客戶
      const newCustomer = await this.findById(result.id);
      if (!newCustomer) {
        throw new Error('Failed to retrieve created customer');
      }

      return newCustomer;
    } catch (error) {
      console.error('Error creating customer:', error);
      throw error;
    }
  }

  /**
   * 尋找或創建客戶 (用於自動客戶創建)
   */
  async findOrCreate(
    platform: string,
    platformUserId: string,
    additionalInfo?: Partial<CreateCustomerData>
  ): Promise<Customer> {
    try {
      // 先嘗試查找現有客戶
      let customer = await this.findByPlatformId(platform, platformUserId);

      if (!customer) {
        // 客戶不存在，創建新客戶
        const createData: CreateCustomerData = {
          platform,
          platformUserId,
          ...additionalInfo
        };
        customer = await this.create(createData);
      } else if (additionalInfo) {
        // 客戶存在但需要更新信息
        const updateData: UpdateCustomerData = {};
        let needsUpdate = false;

        if (additionalInfo.displayName && additionalInfo.displayName !== customer.displayName) {
          updateData.displayName = additionalInfo.displayName;
          needsUpdate = true;
        }

        if (additionalInfo.avatarUrl && additionalInfo.avatarUrl !== customer.avatarUrl) {
          updateData.displayName = additionalInfo.avatarUrl;
          needsUpdate = true;
        }

        if (additionalInfo.email && additionalInfo.email !== customer.email) {
          updateData.email = additionalInfo.email;
          needsUpdate = true;
        }

        if (additionalInfo.phone && additionalInfo.phone !== customer.phone) {
          updateData.phone = additionalInfo.phone;
          needsUpdate = true;
        }

        if (additionalInfo.metadata) {
          const existingMetadata = customer.metadata ? JSON.parse(customer.metadata) : {};
          const mergedMetadata = { ...existingMetadata, ...additionalInfo.metadata };
          updateData.metadata = mergedMetadata;
          needsUpdate = true;
        }

        if (needsUpdate) {
          customer = await this.update(customer.id, updateData);
        }
      }

      return customer;
    } catch (error) {
      console.error('Error in findOrCreate:', error);
      throw error;
    }
  }

  // ======================== 更新操作 ========================

  /**
   * 更新客戶資料
   */
  async update(customerId: number, updateData: UpdateCustomerData): Promise<Customer> {
    try {
      // 檢查客戶是否存在
      const existingCustomer = await this.findById(customerId);
      if (!existingCustomer) {
        throw new CustomerNotFoundError(customerId);
      }

      const timestamp = new Date().toISOString();

      // 準備更新數據
      const updateFields: Partial<typeof customers.$inferInsert> = {
        updatedAt: timestamp
      };

      if (updateData.displayName !== undefined) {
        updateFields.displayName = updateData.displayName;
      }

      if (updateData.email !== undefined) {
        updateFields.email = updateData.email;
      }

      if (updateData.phone !== undefined) {
        updateFields.phone = updateData.phone;
      }

      if (updateData.sourceTeamId !== undefined) {
        updateFields.sourceTeamId = updateData.sourceTeamId;
      }

      if (updateData.metadata !== undefined) {
        updateFields.metadata = updateData.metadata ? JSON.stringify(updateData.metadata) : null;
      }

      // 執行更新
      await this.drizzleDb
        .update(customers)
        .set(updateFields)
        .where(eq(customers.id, customerId));

      // 返回更新後的客戶
      const updatedCustomer = await this.findById(customerId);
      if (!updatedCustomer) {
        throw new Error('Failed to retrieve updated customer');
      }

      return updatedCustomer;
    } catch (error) {
      console.error('Error updating customer:', error);
      throw error;
    }
  }

  // ======================== 刪除操作 ========================

  /**
   * 軟刪除客戶 (標記為非活躍)
   */
  async softDelete(customerId: number): Promise<void> {
    try {
      // 檢查客戶是否存在
      const existingCustomer = await this.findById(customerId);
      if (!existingCustomer) {
        throw new CustomerNotFoundError(customerId);
      }

      // 軟刪除：更新狀態或添加刪除標記
      // 這裡我們可以在metadata中添加deleted標記
      const currentMetadata = existingCustomer.metadata ? JSON.parse(existingCustomer.metadata) : {};
      currentMetadata._deleted = true;
      currentMetadata._deletedAt = new Date().toISOString();

      await this.update(customerId, {
        metadata: currentMetadata
      });
    } catch (error) {
      console.error('Error soft deleting customer:', error);
      throw error;
    }
  }

  // ======================== 私有輔助方法 ========================

  /**
   * 獲取客戶的對話統計
   */
  private async getConversationStats(customerId: number) {
    const totalResult = await this.drizzleDb
      .select({ count: sql<number>`COUNT(*)` })
      .from(conversations)
      .where(eq(conversations.customerId, customerId))
      .get();

    const activeResult = await this.drizzleDb
      .select({ count: sql<number>`COUNT(*)` })
      .from(conversations)
      .where(and(
        eq(conversations.customerId, customerId),
        eq(conversations.status, 'active')
      ))
      .get();

    const closedResult = await this.drizzleDb
      .select({ count: sql<number>`COUNT(*)` })
      .from(conversations)
      .where(and(
        eq(conversations.customerId, customerId),
        eq(conversations.status, 'closed')
      ))
      .get();

    const datesResult = await this.drizzleDb
      .select({
        lastConversationAt: sql<string>`MAX(${conversations.createdAt})`,
        firstConversationAt: sql<string>`MIN(${conversations.createdAt})`
      })
      .from(conversations)
      .where(eq(conversations.customerId, customerId))
      .get();

    return {
      total: totalResult?.count || 0,
      active: activeResult?.count || 0,
      closed: closedResult?.count || 0,
      lastConversationAt: datesResult?.lastConversationAt || null,
      firstConversationAt: datesResult?.firstConversationAt || null
    };
  }

  /**
   * 獲取客戶最近的消息
   */
  private async getRecentMessages(customerId: number, limit: number = 5) {
    const recentMessages = await this.drizzleDb
      .select({
        id: messages.id,
        conversationId: conversations.id,
        senderType: messages.senderType,
        content: messages.content,
        messageType: messages.messageType,
        createdAt: messages.createdAt
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(eq(conversations.customerId, customerId))
      .orderBy(desc(messages.createdAt))
      .limit(limit)
      .all();

    return recentMessages.map(msg => ({
      id: msg.id.toString(),
      conversationId: msg.conversationId.toString(),
      senderType: msg.senderType as 'customer' | 'agent',
      content: msg.content,
      messageType: msg.messageType as 'text' | 'image' | 'file' | 'sticker',
      createdAt: msg.createdAt
    }));
  }
}