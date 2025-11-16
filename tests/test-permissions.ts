// 測試權限控制功能
import { PermissionService } from '@/services/permission-service';

// 模擬 D1 資料庫
class MockD1Database {
  private users = new Map([
    ['1', { id: '1', role: 'admin', is_active: true }],
    ['2', { id: '2', role: 'manager', is_active: true }],
    ['3', { id: '3', role: 'agent', is_active: true }],
    ['4', { id: '4', role: 'agent', is_active: false }]
  ]);

  prepare(query: string) {
    return {
      bind: (userId: string) => ({
        first: async () => {
          if (query.includes('SELECT id, role, is_active FROM agents')) {
            return this.users.get(userId) || null;
          }
          return null;
        }
      })
    };
  }
}

async function testPermissions() {
  console.log('🔐 測試權限控制功能...\n');

  const mockDb = new MockD1Database() as any;

  // 測試 1: Admin 權限
  console.log('📝 測試 1: Admin 權限');
  const adminCanViewAll = await PermissionService.checkPermission(
    1, 'conversation', 'view', undefined, mockDb
  );
  console.log('✅ Admin 可以查看所有對話:', adminCanViewAll);

  const adminCanAssign = await PermissionService.checkPermission(
    1, 'conversation', 'assign', undefined, mockDb
  );
  console.log('✅ Admin 可以指派對話:', adminCanAssign);

  // 測試 2: Manager 權限
  console.log('\n📝 測試 2: Manager 權限');
  const managerCanView = await PermissionService.checkPermission(
    2, 'conversation', 'view', { teamId: 1 }, mockDb
  );
  console.log('✅ Manager 可以查看團隊對話:', managerCanView);

  const managerCanAssign = await PermissionService.checkPermission(
    2, 'conversation', 'assign', undefined, mockDb
  );
  console.log('✅ Manager 可以指派對話:', managerCanAssign);

  // 測試 3: Agent 權限
  console.log('\n📝 測試 3: Agent 權限');
  const agentCanViewAssigned = await PermissionService.checkPermission(
    3, 'conversation', 'view', { assignedUserId: 3 }, mockDb
  );
  console.log('✅ Agent 可以查看指派給自己的對話:', agentCanViewAssigned);

  const agentCannotViewOthers = await PermissionService.checkPermission(
    3, 'conversation', 'view', { assignedUserId: 2 }, mockDb
  );
  console.log('❌ Agent 不能查看指派給其他人的對話:', !agentCannotViewOthers);

  const agentCannotAssign = await PermissionService.checkPermission(
    3, 'conversation', 'assign', undefined, mockDb
  );
  console.log('❌ Agent 不能指派對話:', !agentCannotAssign);

  // 測試 4: 無效用戶
  console.log('\n📝 測試 4: 無效用戶');
  const inactiveUserCannot = await PermissionService.checkPermission(
    4, 'conversation', 'view', undefined, mockDb
  );
  console.log('❌ 非活躍用戶不能執行操作:', !inactiveUserCannot);

  const nonExistentUserCannot = await PermissionService.checkPermission(
    999, 'conversation', 'view', undefined, mockDb
  );
  console.log('❌ 不存在的用戶不能執行操作:', !nonExistentUserCannot);

  // 測試 5: 邊界情況
  console.log('\n📝 測試 5: 邊界情況');
  const invalidParams1 = await PermissionService.checkPermission(
    0, 'conversation', 'view', undefined, mockDb
  );
  console.log('❌ 無效用戶 ID (0):', !invalidParams1);

  const invalidParams2 = await PermissionService.checkPermission(
    1, '', 'view', undefined, mockDb
  );
  console.log('❌ 空資源名稱:', !invalidParams2);

  const invalidParams3 = await PermissionService.checkPermission(
    1, 'conversation', '', undefined, mockDb
  );
  console.log('❌ 空操作名稱:', !invalidParams3);

  console.log('\n🎉 權限測試完成！');
}

// 執行測試
testPermissions().catch(console.error);