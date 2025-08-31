// 團隊管理處理器
import { Context } from 'hono'
import { verify } from 'hono/jwt'
import { v4 as uuidv4 } from 'uuid'
import type { Bindings } from '../types'
import { 
  successResponse, 
  // errorResponse, 
  validationErrorResponse, 
  unauthorizedResponse,
  forbiddenResponse,
  handleApiError 
} from '../utils/api-response'
import { ActivityService, ACTIVITY_ACTIONS, RESOURCE_TYPES } from '../services/activity-service'
import { drizzle } from 'drizzle-orm/d1'
import { sql, eq, desc, ne, and, count } from 'drizzle-orm'
import { agents, conversations } from '../db/schema'

// 驗證管理員權限的輔助函數
async function verifyAdminAuth(c: Context<{ Bindings: Bindings }>) {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) {
    return { error: unauthorizedResponse(c, 'Authorization header required') }
  }
  
  const token = authHeader.replace('Bearer ', '')
  try {
    const payload = await verify(token, c.env.JWT_SECRET) as any
    
    if (payload.role !== 'admin') {
      return { error: forbiddenResponse(c, 'Admin role required') }
    }
    
    return { payload }
  } catch (error: any) {
    return { error: unauthorizedResponse(c, 'Invalid token') }
  }
}


// interface InviteRequest {
//   email: string;
//   name: string;
//   role: 'admin' | 'agent';
// }

// 獲取團隊成員列表
export const getTeamMembers = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const drizzleDb = drizzle(c.env.DB)
    
    // 驗證管理員權限
    const authResult = await verifyAdminAuth(c)
    if (authResult.error) return authResult.error

    // 獲取所有團隊成員
    const members = await drizzleDb
      .select({
        id: agents.id,
        loginId: agents.displayName,
        email: agents.email,
        name: agents.displayName,
        role: agents.role,
        group: sql`''`.as('group'),
        isActive: agents.isActive,
        status: sql`CASE WHEN ${agents.isActive} = 1 THEN 'active' ELSE 'inactive' END`.as('status'),
        createdAt: agents.createdAt,
        lastActive: agents.lastLoginAt
      })
      .from(agents)
      .orderBy(desc(agents.lastLoginAt), desc(agents.createdAt))

    const formattedMembers = members.map((member: any) => ({
      ...member,
      createdAt: member.createdAt ? new Date(member.createdAt) : new Date(),
      lastActive: member.lastActive ? new Date(member.lastActive) : undefined
    }))

    return successResponse(c, formattedMembers, 'Team members retrieved successfully')
  } catch (error: any) {
    return handleApiError(error, c)
  }
}

// 直接新增成員
export const addTeamMember = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const drizzleDb = drizzle(c.env.DB)
    const { loginId, name, email, password, role, isActive } = await c.req.json<{
      loginId: string;
      name?: string;
      email?: string;
      password: string;
      role: 'admin' | 'agent';
      isActive: boolean;
    }>()
    
    // 驗證輸入
    if (!loginId || !password || !role) {
      const errors = [];
      if (!loginId) errors.push({ field: 'loginId', message: 'Login ID is required' });
      if (!password) errors.push({ field: 'password', message: 'Password is required' });
      if (!role) errors.push({ field: 'role', message: 'Role is required' });
      return validationErrorResponse(c, errors)
    }

    if (password.length < 6) {
      return validationErrorResponse(c, [
        { field: 'password', message: 'Password must be at least 6 characters', value: password.length }
      ])
    }
    
    // 驗證管理員權限
    const authResult = await verifyAdminAuth(c)
    if (authResult.error) return authResult.error

    // 檢查 display_name 是否已存在
    const existingUsername = await drizzleDb
      .select({ id: agents.id })
      .from(agents)
      .where(eq(agents.displayName, loginId))
      .get()

    if (existingUsername) {
      return validationErrorResponse(c, [
        { field: 'loginId', message: 'Login ID already exists', value: loginId }
      ])
    }

    // 如果提供了email，檢查email是否已存在
    if (email) {
      const existingEmail = await drizzleDb
        .select({ id: agents.id })
        .from(agents)
        .where(eq(agents.email, email))
        .get()

      if (existingEmail) {
        return validationErrorResponse(c, [
          { field: 'email', message: 'Email already exists', value: email }
        ])
      }
    }

    // 創建新成員
    const memberId = uuidv4()
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(password, 10)
    
    await ((drizzleDb as any)
      .insert(agents)
      .values({
        id: memberId,
        email: email || null,
        passwordHash: passwordHash,
        displayName: name || loginId,
        role: role,
        isActive: isActive,
        createdAt: new Date().toISOString()
      }))

    // 返回新創建的成員資訊
    const newMember = {
      id: memberId,
      loginId,
      email: email || null,
      name: name || loginId,
      role,
      group: '',
      status: isActive ? 'active' : 'inactive',
      isActive,
      createdAt: new Date(),
      lastActive: undefined
    }

    return successResponse(c, newMember, 'Member added successfully')
  } catch (error: any) {
    return handleApiError(error, c)
  }
}

// 邀請新成員 - 暂时禁用，使用直接创建账户模式
export const inviteMember = async (c: Context<{ Bindings: Bindings }>) => {
  // TODO: 邀请机制暂时禁用，等待邮件服务集成后重新启用
  return validationErrorResponse(c, [
    { field: 'invitation', message: 'Invitation feature is temporarily disabled. Please use direct account creation instead.' }
  ]);
}

// 接受邀請 - 暂时禁用
export const acceptInvite = async (c: Context<{ Bindings: Bindings }>) => {
  // TODO: 接受邀请功能暂时禁用，等待邮件服务集成后重新启用
  return validationErrorResponse(c, [
    { field: 'invitation', message: 'Invitation acceptance is temporarily disabled.' }
  ]);
}

// 獲取邀請資訊 - 暂时禁用
export const getInviteInfo = async (c: Context<{ Bindings: Bindings }>) => {
  // TODO: 获取邀请信息功能暂时禁用
  return validationErrorResponse(c, [
    { field: 'invitation', message: 'Invitation info retrieval is temporarily disabled.' }
  ]);
}

// 更新成員狀態
export const updateMemberStatus = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const drizzleDb = drizzle(c.env.DB)
    const memberId = c.req.param('id')
    const { status } = await c.req.json<{ status: 'active' | 'inactive' }>()
    
    // 驗證管理員權限
    const authResult = await verifyAdminAuth(c)
    if (authResult.error) return authResult.error
    const { payload } = authResult

    // 不能停用自己
    if (memberId === payload.userId) {
      return validationErrorResponse(c, [
        { field: 'memberId', message: 'Cannot deactivate your own account', value: memberId }
      ])
    }

    // 獲取成員資訊用於活動記錄
    const member = await drizzleDb
      .select({
        name: agents.displayName,
        email: agents.email,
        role: agents.role
      })
      .from(agents)
      .where(eq(agents.id, memberId))
      .get();

    const isActive = status === 'active'
    await drizzleDb.update(agents).set({ isActive: isActive }).where(eq(agents.id, memberId))

    // 記錄成員狀態更新活動
    const activityService = new ActivityService(c.env.DB);
    await activityService.logActivity({
      userId: payload.userId.toString(),
      userName: payload.username || 'Admin',
      userRole: payload.role,
      action: ACTIVITY_ACTIONS.TEAM_MEMBER_UPDATE,
      resourceType: RESOURCE_TYPES.TEAM,
      resourceId: memberId,
      details: {
        memberName: member?.name,
        memberEmail: member?.email,
        memberRole: member?.role,
        statusChange: {
          from: !isActive ? 'active' : 'inactive',
          to: status
        }
      },
      ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
      userAgent: c.req.header('User-Agent')
    });

    return successResponse(c, null, 'Member status updated successfully')
  } catch (error: any) {
    return handleApiError(error, c)
  }
}

// 更新成員角色
export const updateMemberRole = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const drizzleDb = drizzle(c.env.DB)
    const memberId = c.req.param('id')
    const { role } = await c.req.json<{ role: 'admin' | 'agent' }>()
    
    // 驗證管理員權限
    const authResult = await verifyAdminAuth(c)
    if (authResult.error) return authResult.error
    const { payload } = authResult

    // 不能修改自己的角色
    if (memberId === payload.userId) {
      return validationErrorResponse(c, [
        { field: 'memberId', message: 'Cannot change your own role', value: memberId }
      ])
    }

    // 獲取成員原始資訊
    const member = await drizzleDb
      .select({
        name: agents.displayName,
        email: agents.email,
        role: agents.role
      })
      .from(agents)
      .where(eq(agents.id, memberId))
      .get();

    await drizzleDb
      drizzle(c.env.DB).update(agents).set({ role: role }).where(eq(agents.id, memberId))

    // 記錄角色更新活動
    const activityService = new ActivityService(c.env.DB);
    await activityService.logActivity({
      userId: payload.userId.toString(),
      userName: payload.username || 'Admin',
      userRole: payload.role,
      action: ACTIVITY_ACTIONS.TEAM_MEMBER_UPDATE,
      resourceType: RESOURCE_TYPES.TEAM,
      resourceId: memberId,
      details: {
        memberName: member?.name,
        memberEmail: member?.email,
        roleChange: {
          from: member?.role,
          to: role
        }
      },
      ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
      userAgent: c.req.header('User-Agent')
    });

    return successResponse(c, null, 'Member role updated successfully')
  } catch (error: any) {
    return handleApiError(error, c)
  }
}

// 重設成員密碼
export const resetMemberPassword = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const drizzleDb = drizzle(c.env.DB)
    const memberId = c.req.param('id')
    
    // 驗證管理員權限
    const authResult = await verifyAdminAuth(c)
    if (authResult.error) return authResult.error

    // 生成新密碼
    const newPassword = Math.random().toString(36).slice(-8)
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(newPassword, 10)

    await drizzleDb
      drizzle(c.env.DB).update(agents).set({ passwordHash: passwordHash }).where(eq(agents.id, memberId))

    // 在實際環境中，這裡會發送郵件通知用戶新密碼
    console.log(`Password reset completed for member ${memberId}`)

    return successResponse(c, { newPassword }, 'Password reset successfully')
  } catch (error: any) {
    return handleApiError(error, c)
  }
}

// 重設成員密碼帶政策
export const resetPasswordWithPolicy = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const drizzleDb = drizzle(c.env.DB)
    const memberId = c.req.param('id')
    const { newPassword, policy } = await c.req.json<{
      newPassword: string;
      policy: 'changeable' | 'unchangeable' | 'must_change';
    }>()
    
    // 驗證輸入
    if (!newPassword || !policy) {
      const errors = [];
      if (!newPassword) errors.push({ field: 'newPassword', message: 'New password is required' });
      if (!policy) errors.push({ field: 'policy', message: 'Password policy is required' });
      return validationErrorResponse(c, errors)
    }

    if (newPassword.length < 6) {
      return validationErrorResponse(c, [
        { field: 'newPassword', message: 'Password must be at least 6 characters', value: newPassword.length }
      ])
    }

    if (!['changeable', 'unchangeable', 'must_change'].includes(policy)) {
      return validationErrorResponse(c, [
        { field: 'policy', message: 'Invalid password policy', value: policy }
      ])
    }
    
    // 驗證管理員權限
    const authResult = await verifyAdminAuth(c)
    if (authResult.error) return authResult.error
    const { payload } = authResult

    // 不能修改自己的密碼
    if (memberId === payload.userId) {
      return validationErrorResponse(c, [
        { field: 'memberId', message: 'Cannot reset your own password', value: memberId }
      ])
    }

    // 獲取成員資訊用於活動記錄
    const member = await drizzleDb
      .select({
        name: agents.displayName,
        email: agents.email,
        role: agents.role
      })
      .from(agents)
      .where(eq(agents.id, memberId))
      .get();

    if (!member) {
      return validationErrorResponse(c, [
        { field: 'memberId', message: 'Member not found', value: memberId }
      ])
    }

    // 加密新密碼
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(newPassword, 10)

    // 更新密碼和密碼政策
    await drizzleDb
      drizzle(c.env.DB).update(agents).set({ 
        passwordHash: passwordHash, 
        passwordPolicy: policy, 
        updatedAt: sql`CURRENT_TIMESTAMP` 
      }).where(eq(agents.id, memberId))

    // 記錄密碼重設活動
    const activityService = new ActivityService(c.env.DB);
    await activityService.logActivity({
      userId: payload.userId.toString(),
      userName: payload.username || 'Admin',
      userRole: payload.role,
      action: ACTIVITY_ACTIONS.TEAM_MEMBER_UPDATE,
      resourceType: RESOURCE_TYPES.TEAM,
      resourceId: memberId,
      details: {
        memberName: member.name,
        memberEmail: member.email,
        memberRole: member.role,
        action: 'password_reset_with_policy',
        policy: policy
      },
      ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
      userAgent: c.req.header('User-Agent')
    });

    // 返回成功響應，不包含實際密碼
    return successResponse(c, { 
      policy,
      message: `Password updated successfully with ${policy} policy`
    }, 'Password reset with policy successfully')
  } catch (error: any) {
    return handleApiError(error, c)
  }
}

// 更改密碼（用於強制密碼更改）
export const changePassword = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const drizzleDb = drizzle(c.env.DB)
    const { currentPassword, newPassword } = await c.req.json<{
      currentPassword?: string;
      newPassword: string;
    }>()
    
    // 驗證輸入
    if (!newPassword) {
      return validationErrorResponse(c, [
        { field: 'newPassword', message: 'New password is required' }
      ])
    }

    if (newPassword.length < 6) {
      return validationErrorResponse(c, [
        { field: 'newPassword', message: 'Password must be at least 6 characters', value: newPassword.length }
      ])
    }

    if (currentPassword && currentPassword === newPassword) {
      return validationErrorResponse(c, [
        { field: 'newPassword', message: 'New password must be different from current password' }
      ])
    }
    
    // 驗證token（可能是臨時token或普通token）
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return unauthorizedResponse(c, 'Authorization token required');
    }

    const token = authHeader.substring(7);
    const jwt = await import('jsonwebtoken');
    
    let payload;
    try {
      payload = jwt.verify(token, c.env.JWT_SECRET) as any;
    } catch (error: any) {
      return unauthorizedResponse(c, 'Invalid token');
    }

    const userId = payload.userId;

    // 獲取用戶資訊
    const user = await drizzleDb
      .select({
        passwordHash: agents.passwordHash,
        passwordPolicy: agents.passwordPolicy
      })
      .from(agents)
      .where(and(eq(agents.id, userId), eq(agents.isActive, true)))
      .get();

    if (!user) {
      return validationErrorResponse(c, [
        { field: 'userId', message: 'User not found or inactive', value: userId }
      ])
    }

    const bcrypt = await import('bcryptjs');
    
    // 如果提供了當前密碼，則驗證；如果是強制更改則跳過驗證
    if (currentPassword) {
      const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
      
      if (!isValidPassword) {
        return validationErrorResponse(c, [
          { field: 'currentPassword', message: 'Current password is incorrect' }
        ])
      }
    }

    // 加密新密碼
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // 更新密碼並設置政策為可更改（完成強制更改後）
    await drizzleDb
      drizzle(c.env.DB).update(agents).set({ 
        passwordHash: passwordHash, 
        passwordPolicy: 'changeable', 
        updatedAt: sql`CURRENT_TIMESTAMP` 
      }).where(eq(agents.id, userId));

    // 記錄活動
    const activityService = new ActivityService(c.env.DB);
    await activityService.logActivity({
      userId: userId.toString(),
      userName: payload.username || payload.email || 'User',
      userRole: payload.role,
      action: ACTIVITY_ACTIONS.TEAM_MEMBER_UPDATE,
      resourceType: RESOURCE_TYPES.TEAM,
      resourceId: userId.toString(),
      details: {
        action: 'password_changed',
        wasForced: user.passwordPolicy === 'must_change'
      },
      ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
      userAgent: c.req.header('User-Agent')
    });

    return successResponse(c, null, 'Password changed successfully')
  } catch (error: any) {
    return handleApiError(error, c)
  }
}

// 獲取成員解密密碼
export const getMemberPassword = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const drizzleDb = drizzle(c.env.DB)
    const memberId = c.req.param('id')
    
    // 驗證管理員權限
    const authResult = await verifyAdminAuth(c)
    if (authResult.error) return authResult.error

    // 獲取成員資訊
    const member = await drizzleDb
      .select({
        displayName: agents.displayName,
        passwordHash: agents.passwordHash
      })
      .from(agents)
      .where(eq(agents.id, memberId))
      .get()

    if (!member) {
      return validationErrorResponse(c, [
        { field: 'memberId', message: 'Member not found', value: memberId }
      ])
    }

    // 密碼已改為單向雜湊，無法解密
    const decryptedPassword = '密碼已加密儲存，無法查看 - 請使用重設密碼功能'

    return successResponse(c, { 
      password: decryptedPassword,
      username: member.displayName,
      displayName: member.displayName
    }, 'Password retrieved successfully')
  } catch (error: any) {
    return handleApiError(error, c)
  }
}

// 更新成員資訊
export const updateMember = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const drizzleDb = drizzle(c.env.DB)
    const memberId = c.req.param('id')
    const updateData = await c.req.json<{
      name?: string;
      email?: string;
      password?: string;
      role?: 'admin' | 'agent';
      group?: string;
      status?: 'active' | 'inactive';
    }>()
    
    // 驗證管理員權限
    const authResult = await verifyAdminAuth(c)
    if (authResult.error) return authResult.error
    const { payload } = authResult

    // 不能修改自己的角色或狀態
    if (memberId === payload.userId) {
      if (updateData.role || updateData.status === 'inactive') {
        return validationErrorResponse(c, [
          { field: 'memberId', message: 'Cannot modify your own role or deactivate your account', value: memberId }
        ])
      }
    }

    // 獲取當前成員資訊
    const currentMember = await drizzleDb
      .select({
        name: agents.displayName,
        email: agents.email,
        role: agents.role,
        isActive: agents.isActive
      })
      .from(agents)
      .where(eq(agents.id, memberId))
      .get()

    if (!currentMember) {
      return validationErrorResponse(c, [
        { field: 'memberId', message: 'Member not found', value: memberId }
      ])
    }

    // 驗證email唯一性（如果更新了email）
    if (updateData.email && updateData.email !== currentMember.email) {
      const existingEmail = await drizzleDb
        .select({ id: agents.id })
        .from(agents)
        .where(and(eq(agents.email, updateData.email), ne(agents.id, memberId)))
        .get()

      if (existingEmail) {
        return validationErrorResponse(c, [
          { field: 'email', message: 'Email already exists', value: updateData.email }
        ])
      }
    }

    // 準備更新字段
    // 驗證是否有欄位需要更新
    const hasUpdates = updateData.name !== undefined || updateData.email !== undefined || 
                      updateData.role !== undefined || updateData.status !== undefined ||
                      (updateData.password !== undefined && updateData.password.trim() !== '');

    if (!hasUpdates) {
      return validationErrorResponse(c, [
        { field: 'updateData', message: 'No fields to update' }
      ])
    }

    // 如果提供了新密碼，驗證長度
    if (updateData.password !== undefined && updateData.password.trim() !== '') {
      if (updateData.password.length < 6) {
        return validationErrorResponse(c, [
          { field: 'password', message: 'Password must be at least 6 characters', value: updateData.password.length }
        ])
      }
    }

    // 構建 Drizzle 更新對象
    const updateObject: any = { updatedAt: sql`CURRENT_TIMESTAMP` };
    
    if (updateData.name !== undefined) {
      updateObject.displayName = updateData.name;
    }
    if (updateData.email !== undefined) {
      updateObject.email = updateData.email;
    }
    if (updateData.role !== undefined) {
      updateObject.role = updateData.role;
    }
    if (updateData.status !== undefined) {
      updateObject.isActive = updateData.status === 'active';
    }
    if (updateData.password !== undefined && updateData.password.trim() !== '') {
      const bcrypt = await import('bcryptjs');
      updateObject.passwordHash = await bcrypt.hash(updateData.password, 10);
    }

    // 執行更新
    await drizzleDb.update(agents).set(updateObject).where(eq(agents.id, memberId))

    // 記錄活動
    const activityService = new ActivityService(c.env.DB);
    await activityService.logActivity({
      userId: payload.userId.toString(),
      userName: payload.username || 'Admin',
      userRole: payload.role,
      action: ACTIVITY_ACTIONS.TEAM_MEMBER_UPDATE,
      resourceType: RESOURCE_TYPES.TEAM,
      resourceId: memberId,
      details: {
        memberName: updateData.name || currentMember.name,
        memberEmail: updateData.email || currentMember.email,
        changes: updateData
      },
      ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
      userAgent: c.req.header('User-Agent')
    });

    // 返回更新後的成員資訊
    const updatedMember = await drizzleDb
      .select({
        id: agents.id,
        loginId: agents.displayName,
        email: agents.email,
        name: agents.displayName,
        role: agents.role,
        group: sql`''`.as('group'),
        isActive: agents.isActive,
        status: sql`CASE WHEN ${agents.isActive} = 1 THEN 'active' ELSE 'inactive' END`.as('status'),
        createdAt: agents.createdAt,
        lastActive: agents.lastLoginAt
      })
      .from(agents)
      .where(eq(agents.id, memberId))
      .get()

    return successResponse(c, updatedMember, 'Member updated successfully')
  } catch (error: any) {
    return handleApiError(error, c)
  }
}

// 遷移明文密碼到加密存儲 (臨時管理端點)
export const migratePasswords = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    // 驗證管理員權限
    const authResult = await verifyAdminAuth(c)
    if (authResult.error) return authResult.error

    console.log('🔄 Starting password migration...')
    
    // 由於新的架構已經不使用明文密碼，這個函數已經不再需要
    // 所有密碼都應該已經是加密的
    console.log(`📋 Password encryption migration is no longer needed - all passwords are now hashed`)

    const results = [
      { status: 'info', message: 'Password encryption migration is no longer needed - all passwords are now hashed' }
    ]

    return successResponse(c, { 
      migrated: results,
      total: 0 
    }, 'Password migration completed')
  } catch (error: any) {
    return handleApiError(error, c)
  }
}

// 刪除成員
export const deleteMember = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const drizzleDb = drizzle(c.env.DB)
    const memberId = c.req.param('id')
    
    // 驗證管理員權限
    const authResult = await verifyAdminAuth(c)
    if (authResult.error) return authResult.error
    const { payload } = authResult

    // 不能刪除自己
    if (memberId === payload.userId) {
      return validationErrorResponse(c, [
        { field: 'memberId', message: 'Cannot delete your own account', value: memberId }
      ])
    }

    // 檢查是否有分配的對話
    const assignedConversations = await drizzleDb
      .select({ count: count() })
      .from(conversations)
      .where(eq(conversations.assignedUserId, memberId))
      .get()

    if (assignedConversations && assignedConversations.count > 0) {
      return validationErrorResponse(c, [
        { field: 'memberId', message: 'Member has assigned conversations, please reassign first', value: assignedConversations.count }
      ])
    }

    await drizzleDb
      drizzle(c.env.DB).delete(agents).where(eq(agents.id, memberId))

    return successResponse(c, null, 'Member deleted successfully')
  } catch (error: any) {
    return handleApiError(error, c)
  }
}

// 獲取邀請列表 - 暂时禁用
export const getInvitations = async (c: Context<{ Bindings: Bindings }>) => {
  // TODO: 获取邀请列表功能暂时禁用
  return validationErrorResponse(c, [
    { field: 'invitation', message: 'Invitation list retrieval is temporarily disabled.' }
  ]);
}

// 撤銷邀請 - 暂时禁用
export const revokeInvitation = async (c: Context<{ Bindings: Bindings }>) => {
  // TODO: 撤销邀请功能暂时禁用
  return validationErrorResponse(c, [
    { field: 'invitation', message: 'Invitation revocation is temporarily disabled.' }
  ]);

  /* 
  // 原有代码保留，暂时注释
  try {
    const drizzleDb = drizzle(c.env.DB)
    const invitationId = c.req.param('id')
    
    // 驗證管理員權限
    const authResult = await verifyAdminAuth(c)
    if (authResult.error) return authResult.error

    await drizzleDb
      drizzle(c.env.DB).delete(invitations).where(and(eq(invitations.id, invitationId), isNull(invitations.usedAt)))

    return successResponse(c, null, 'Invitation revoked successfully')
  } catch (error: any) {
    return handleApiError(error, c)
  }
  */
}