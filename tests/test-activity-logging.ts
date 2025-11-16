// 測試活動記錄功能
import { ActivityService, ACTIVITY_ACTIONS, RESOURCE_TYPES } from '@/services/activity-service';

// 模擬 D1 資料庫
class MockD1Database {
  private data: any[] = [];
  private nextId = 1;

  prepare(query: string) {
    return {
      bind: (...params: any[]) => ({
        run: async () => {
          if (query.includes('INSERT INTO activities')) {
            const activity = {
              id: this.nextId++,
              user_id: params[0],
              user_name: params[1],
              user_role: params[2],
              action: params[3],
              resource_type: params[4],
              resource_id: params[5],
              details: params[6],
              ip_address: params[7],
              user_agent: params[8],
              created_at: new Date().toISOString()
            };
            this.data.push(activity);
            console.log('✅ Activity logged:', activity);
            return { success: true };
          }
          return { success: true };
        },
        first: async () => {
          if (query.includes('SELECT COUNT(*)')) {
            return { count: this.data.length };
          }
          return null;
        },
        all: async () => {
          if (query.includes('SELECT') && query.includes('FROM activities')) {
            return { results: this.data };
          }
          return { results: [] };
        }
      })
    };
  }

  getData() {
    return this.data;
  }
}

async function testActivityLogging() {
  console.log('🧪 測試活動記錄功能...\n');

  const mockDb = new MockD1Database() as any;
  const activityService = new ActivityService(mockDb);

  // 測試 1: 記錄用戶登入
  console.log('📝 測試 1: 記錄用戶登入');
  await activityService.logActivity({
    userId: 'admin-001',
    userName: 'Admin User',
    userRole: 'admin',
    action: ACTIVITY_ACTIONS.USER_LOGIN,
    resourceType: RESOURCE_TYPES.USER,
    resourceId: 'admin-001',
    details: {
      loginMethod: 'email',
      sessionId: 'session-123'
    },
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0 Test Browser'
  });

  // 測試 2: 記錄對話指派
  console.log('\n📝 測試 2: 記錄對話指派');
  await activityService.logActivity({
    userId: 'admin-001',
    userName: 'Admin User',
    userRole: 'admin',
    action: ACTIVITY_ACTIONS.CONVERSATION_ASSIGN,
    resourceType: RESOURCE_TYPES.CONVERSATION,
    resourceId: 'conv-123',
    details: {
      fromAgent: null,
      toAgent: 'agent-001',
      previousStatus: 'open'
    },
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0 Test Browser'
  });

  // 測試 3: 記錄系統設定更新
  console.log('\n📝 測試 3: 記錄系統設定更新');
  await activityService.logActivity({
    userId: 'admin-001',
    userName: 'Admin User',
    userRole: 'admin',
    action: ACTIVITY_ACTIONS.SETTINGS_UPDATE,
    resourceType: RESOURCE_TYPES.SYSTEM,
    details: {
      updatedSettings: {
        'general.systemName': 'Multi-Channel Support',
        'general.contactEmail': 'admin@example.com'
      },
      settingsCount: 2
    },
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0 Test Browser'
  });

  // 測試 4: 獲取活動記錄列表
  console.log('\n📝 測試 4: 獲取活動記錄列表');
  const activities = await activityService.getActivities({
    page: 1,
    pageSize: 10
  });
  console.log('✅ 活動記錄列表:', activities);

  // 測試 5: 獲取用戶活動統計
  console.log('\n📝 測試 5: 獲取用戶活動統計');
  const stats = await activityService.getUserActivityStats('admin-001', 30);
  console.log('✅ 用戶活動統計:', stats);

  console.log('\n🎉 所有測試完成！');
  console.log('📊 總共記錄的活動數量:', mockDb.getData().length);
}

// 執行測試
testActivityLogging().catch(console.error);