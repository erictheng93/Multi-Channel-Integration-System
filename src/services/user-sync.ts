// 用戶資料同步服務
import { eq, and, isNull } from 'drizzle-orm';
import { createDbClient } from '../db/drizzle-factory';
import { customers } from '../db/schema';
import type { 
  Bindings
} from '../types';
import { 
  isLineProfile,
  isFacebookProfile
} from '../types';
import { getLineUserProfile, getLineGroupMemberProfile } from '../utils/line';

export interface UserProfile {
  platformUserId: string;
  platform: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
  locale?: string;
  timezone?: number;
  firstName?: string;
  lastName?: string;
  lastUpdated: Date;
}

export class UserSyncService {
  constructor(private env: Bindings) {}

  /**
   * 同步 LINE 用戶資料
   */
  async syncLineUser(userId: string, groupId?: string): Promise<UserProfile | null> {
    try {
      console.log(`Syncing LINE user profile: ${userId}`);
      
      let profile;
      if (groupId) {
        // 如果是群組訊息，獲取群組成員資料
        profile = await getLineGroupMemberProfile(
          this.env.LINE_CHANNEL_ACCESS_TOKEN, 
          groupId, 
          userId
        );
      } else {
        // 獲取一般用戶資料
        profile = await getLineUserProfile(
          this.env.LINE_CHANNEL_ACCESS_TOKEN, 
          userId
        );
      }

      if (!profile) {
        console.warn(`Failed to get LINE user profile: ${userId}`);
        return null;
      }

      const userProfile: UserProfile = {
        platformUserId: userId,
        platform: 'line',
        displayName: profile.displayName || 'LINE User',
        pictureUrl: profile.pictureUrl || '',
        statusMessage: isLineProfile(profile) ? profile.statusMessage || '' : '',
        lastUpdated: new Date()
      };

      // 更新資料庫中的用戶資料
      await this.updateUserInDatabase(userProfile);
      
      console.log(`LINE user profile synced: ${userProfile.displayName}`);
      return userProfile;
    } catch (error) {
      console.error('Error syncing LINE user:', error);
      return null;
    }
  }

  /**
   * 同步 Facebook 用戶資料
   */
  async syncFacebookUser(userId: string): Promise<UserProfile | null> {
    try {
      console.log(`Syncing Facebook user profile: ${userId}`);
      
      // 使用 Facebook Graph API 獲取用戶資料
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${userId}?fields=first_name,last_name,profile_pic,locale,timezone&access_token=${this.env.FB_PAGE_ACCESS_TOKEN}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        console.warn(`Failed to get Facebook user profile: ${response.status}`);
        return null;
      }

      const profile = await response.json();
      
      const userProfile: UserProfile = {
        platformUserId: userId,
        platform: 'facebook',
        displayName: isFacebookProfile(profile) 
          ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Facebook User'
          : 'Facebook User',
        pictureUrl: isFacebookProfile(profile) ? profile.profile_pic || '' : '',
        locale: isFacebookProfile(profile) ? profile.locale || '' : '',
        timezone: isFacebookProfile(profile) ? profile.timezone || 0 : 0,
        firstName: isFacebookProfile(profile) ? profile.first_name || '' : '',
        lastName: isFacebookProfile(profile) ? profile.last_name || '' : '',
        lastUpdated: new Date()
      };

      // 更新資料庫中的用戶資料
      await this.updateUserInDatabase(userProfile);
      
      console.log(`Facebook user profile synced: ${userProfile.displayName}`);
      return userProfile;
    } catch (error) {
      console.error('Error syncing Facebook user:', error);
      return null;
    }
  }

  /**
   * 批量同步用戶資料
   */
  async syncMultipleUsers(userIds: Array<{ userId: string; platform: string; groupId?: string }>): Promise<UserProfile[]> {
    console.log(`Batch syncing ${userIds.length} users`);
    
    const results: UserProfile[] = [];
    const promises = userIds.map(async ({ userId, platform, groupId }) => {
      try {
        let profile: UserProfile | null = null;
        
        if (platform === 'line') {
          profile = await this.syncLineUser(userId, groupId);
        } else if (platform === 'facebook') {
          profile = await this.syncFacebookUser(userId);
        }
        
        if (profile) {
          results.push(profile);
        }
      } catch (error) {
        console.error(`Failed to sync user ${userId} (${platform}):`, error);
      }
    });

    await Promise.all(promises);
    
    console.log(`Batch sync completed: ${results.length}/${userIds.length} users synced`);
    return results;
  }

  /**
   * 定期同步過期的用戶資料
   */
  async syncStaleUsers(maxAge: number = 24 * 60 * 60 * 1000): Promise<number> {
    try {
      const cutoffTime = new Date(Date.now() - maxAge);
      console.log(`Syncing stale users (older than ${new Date(cutoffTime).toISOString()})`);
      
      // 查詢需要更新的用戶
      const drizzleDb = createDbClient(this.env.DB);
      const staleUsers = await drizzleDb
        .select({
          platformUserId: customers.platformUserId,
          platform: customers.platform
        })
        .from(customers)
        .where(
          isNull(customers.updatedAt)
        )
        .orderBy(customers.updatedAt)
        .limit(50);

      if (staleUsers.length === 0) {
        console.log('No stale users found');
        return 0;
      }

      const userList = staleUsers.map((user) => ({
        userId: user.platformUserId,
        platform: user.platform
      }));

      const synced = await this.syncMultipleUsers(userList);
      
      console.log(`Stale user sync completed: ${synced.length} users updated`);
      return synced.length;
    } catch (error) {
      console.error('Error syncing stale users:', error);
      return 0;
    }
  }

  /**
   * 更新資料庫中的用戶資料
   */
  private async updateUserInDatabase(userProfile: UserProfile): Promise<void> {
    try {
      const drizzleDb = createDbClient(this.env.DB);
      const timestamp = new Date().toISOString();
      
      await drizzleDb
        .update(customers)
        .set({
          displayName: userProfile.displayName,
          avatarUrl: userProfile.pictureUrl || null,
          updatedAt: timestamp
        })
        .where(
          and(
            eq(customers.platformUserId, userProfile.platformUserId),
            eq(customers.platform, userProfile.platform)
          )
        );
    } catch (error) {
      console.error('Error updating user in database:', error);
      throw error;
    }
  }

  /**
   * 獲取用戶資料（從資料庫或實時同步）
   */
  async getUserProfile(userId: string, platform: string, forceSync = false): Promise<UserProfile | null> {
    try {
      // 如果不強制同步，先嘗試從資料庫獲取
      if (!forceSync) {
        const drizzleDb = createDbClient(this.env.DB);
        const user = await drizzleDb
          .select()
          .from(customers)
          .where(
            and(
              eq(customers.platformUserId, userId),
              eq(customers.platform, platform)
            )
          )
          .get();

        if (user) {
          // 使用 updatedAt 並提供預設值
          const lastUpdated = user.updatedAt ? new Date(user.updatedAt) : null;
          const isRecent = lastUpdated && (Date.now() - lastUpdated.getTime()) < 24 * 60 * 60 * 1000;
          
          if (isRecent) {
            return {
              platformUserId: userId,
              platform,
              displayName: user.displayName || 'Unknown User',
              pictureUrl: user.avatarUrl || '',
              statusMessage: '',
              locale: '',
              timezone: 0,
              firstName: '',
              lastName: '',
              lastUpdated: lastUpdated || new Date()
            };
          }
        }
      }

      // 實時同步用戶資料
      if (platform === 'line') {
        return await this.syncLineUser(userId);
      } else if (platform === 'facebook') {
        return await this.syncFacebookUser(userId);
      }

      return null;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  /**
   * 檢查用戶資料是否需要更新
   */
  async needsUpdate(userId: string, platform: string, maxAge = 24 * 60 * 60 * 1000): Promise<boolean> {
    try {
      const drizzleDb = createDbClient(this.env.DB);
      const user = await drizzleDb
        .select({
          updatedAt: customers.updatedAt
        })
        .from(customers)
        .where(
          and(
            eq(customers.platformUserId, userId),
            eq(customers.platform, platform)
          )
        )
        .get();

      if (!user) return true;

      const lastUpdated = user.updatedAt ? new Date(user.updatedAt) : null;
      
      if (!lastUpdated) return true;
      
      return (Date.now() - lastUpdated.getTime()) > maxAge;
    } catch (error) {
      console.error('Error checking if user needs update:', error);
      return true; // 如果查詢失敗，總是嘗試更新
    }
  }
}

/**
 * 建立用戶同步服務實例
 */
export function createUserSyncService(env: Bindings): UserSyncService {
  return new UserSyncService(env);
}