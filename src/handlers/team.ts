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
  } catch (error) {
    return { error: unauthorizedResponse(c, 'Invalid token') }
  }
}

interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'agent';
  isActive: boolean;
  createdAt: Date;
  lastActive?: Date;
}

// interface InviteRequest {
//   email: string;
//   name: string;
//   role: 'admin' | 'agent';
// }

// 獲取團隊成員列表
export const getTeamMembers = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const db = c.env.DB
    
    // 驗證管理員權限
    const authResult = await verifyAdminAuth(c)
    if (authResult.error) return authResult.error

    // 獲取所有團隊成員
    const members = await db
      .prepare(`
        SELECT 
          id,
          username as loginId,
          email,
          display_name as name,
          role,
          '' as "group",
          is_active as isActive,
          CASE WHEN is_active = 1 THEN 'active' ELSE 'inactive' END as status,
          created_at as createdAt,
          last_login_at as lastActive
        FROM agents 
        ORDER BY last_login_at DESC, created_at DESC
      `)
      .all<TeamMember>()

    const formattedMembers = members.results.map(member => ({
      ...member,
      createdAt: new Date(member.createdAt),
      lastActive: member.lastActive ? new Date(member.lastActive) : undefined
    }))

    return successResponse(c, formattedMembers, 'Team members retrieved successfully')
  } catch (error) {
    return handleApiError(error, c)
  }
}

// 直接新增成員
export const addTeamMember = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const db = c.env.DB
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

    // 檢查 username 是否已存在
    const existingUsername = await db
      .prepare('SELECT id FROM agents WHERE username = ?')
      .bind(loginId)
      .first()

    if (existingUsername) {
      return validationErrorResponse(c, [
        { field: 'loginId', message: 'Login ID already exists', value: loginId }
      ])
    }

    // 如果提供了email，檢查email是否已存在
    if (email) {
      const existingEmail = await db
        .prepare('SELECT id FROM agents WHERE email = ?')
        .bind(email)
        .first()

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
    
    await db
      .prepare(`
        INSERT INTO agents (
          id, username, email, password_hash, display_name, role, 
          is_active, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        memberId,
        loginId,
        email || null,
        passwordHash,
        name || loginId,
        role,
        isActive ? 1 : 0,
        Date.now()
      )
      .run()

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
  } catch (error) {
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
    const db = c.env.DB
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
    const member = await db
      .prepare('SELECT display_name as name, email, role FROM agents WHERE id = ?')
      .bind(memberId)
      .first<{ name: string; email: string; role: string }>();

    const isActive = status === 'active'
    await db
      .prepare('UPDATE agents SET is_active = ? WHERE id = ?')
      .bind(isActive ? 1 : 0, memberId)
      .run()

    // 記錄成員狀態更新活動
    const activityService = new ActivityService(db);
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
  } catch (error) {
    return handleApiError(error, c)
  }
}

// 更新成員角色
export const updateMemberRole = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const db = c.env.DB
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
    const member = await db
      .prepare('SELECT display_name as name, email, role FROM agents WHERE id = ?')
      .bind(memberId)
      .first<{ name: string; email: string; role: string }>();

    await db
      .prepare('UPDATE agents SET role = ? WHERE id = ?')
      .bind(role, memberId)
      .run()

    // 記錄角色更新活動
    const activityService = new ActivityService(db);
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
  } catch (error) {
    return handleApiError(error, c)
  }
}

// 重設成員密碼
export const resetMemberPassword = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const db = c.env.DB
    const memberId = c.req.param('id')
    
    // 驗證管理員權限
    const authResult = await verifyAdminAuth(c)
    if (authResult.error) return authResult.error

    // 生成新密碼
    const newPassword = Math.random().toString(36).slice(-8)
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(newPassword, 10)

    await db
      .prepare('UPDATE agents SET password_hash = ? WHERE id = ?')
      .bind(passwordHash, memberId)
      .run()

    // 在實際環境中，這裡會發送郵件通知用戶新密碼
    console.log(`New password for member ${memberId}: ${newPassword}`)

    return successResponse(c, { newPassword }, 'Password reset successfully')
  } catch (error) {
    return handleApiError(error, c)
  }
}

// 重設成員密碼帶政策
export const resetPasswordWithPolicy = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const db = c.env.DB
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
    const member = await db
      .prepare('SELECT display_name as name, email, role FROM agents WHERE id = ?')
      .bind(memberId)
      .first<{ name: string; email: string; role: string }>();

    if (!member) {
      return validationErrorResponse(c, [
        { field: 'memberId', message: 'Member not found', value: memberId }
      ])
    }

    // 加密新密碼
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(newPassword, 10)

    // 更新密碼和密碼政策
    await db
      .prepare('UPDATE agents SET password_hash = ?, password_policy = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(passwordHash, policy, memberId)
      .run()

    // 記錄密碼重設活動
    const activityService = new ActivityService(db);
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
  } catch (error) {
    return handleApiError(error, c)
  }
}

// 更改密碼（用於強制密碼更改）
export const changePassword = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const db = c.env.DB
    const { currentPassword, newPassword } = await c.req.json<{
      currentPassword: string;
      newPassword: string;
    }>()
    
    // 驗證輸入
    if (!currentPassword || !newPassword) {
      const errors = [];
      if (!currentPassword) errors.push({ field: 'currentPassword', message: 'Current password is required' });
      if (!newPassword) errors.push({ field: 'newPassword', message: 'New password is required' });
      return validationErrorResponse(c, errors)
    }

    if (newPassword.length < 6) {
      return validationErrorResponse(c, [
        { field: 'newPassword', message: 'Password must be at least 6 characters', value: newPassword.length }
      ])
    }

    if (currentPassword === newPassword) {
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
    } catch (error) {
      return unauthorizedResponse(c, 'Invalid token');
    }

    const userId = payload.userId;

    // 獲取用戶資訊
    const user = await db
      .prepare('SELECT password_hash, password_policy FROM agents WHERE id = ? AND is_active = 1')
      .bind(userId)
      .first<{ password_hash: string; password_policy: string }>();

    if (!user) {
      return validationErrorResponse(c, [
        { field: 'userId', message: 'User not found or inactive', value: userId }
      ])
    }

    // 驗證當前密碼
    const bcrypt = await import('bcryptjs');
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    
    if (!isValidPassword) {
      return validationErrorResponse(c, [
        { field: 'currentPassword', message: 'Current password is incorrect' }
      ])
    }

    // 加密新密碼
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // 更新密碼並設置政策為可更改（完成強制更改後）
    await db
      .prepare('UPDATE agents SET password_hash = ?, password_policy = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(passwordHash, 'changeable', userId)
      .run();

    // 記錄活動
    const activityService = new ActivityService(db);
    await activityService.logActivity({
      userId: userId.toString(),
      userName: payload.username || payload.email || 'User',
      userRole: payload.role,
      action: ACTIVITY_ACTIONS.TEAM_MEMBER_UPDATE,
      resourceType: RESOURCE_TYPES.TEAM,
      resourceId: userId.toString(),
      details: {
        action: 'password_changed',
        wasForced: user.password_policy === 'must_change'
      },
      ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
      userAgent: c.req.header('User-Agent')
    });

    return successResponse(c, null, 'Password changed successfully')
  } catch (error) {
    return handleApiError(error, c)
  }
}

// 刪除成員
export const deleteMember = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const db = c.env.DB
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
    const assignedConversations = await db
      .prepare('SELECT COUNT(*) as count FROM conversations WHERE assigned_to = ?')
      .bind(memberId)
      .first<{ count: number }>()

    if (assignedConversations && assignedConversations.count > 0) {
      return validationErrorResponse(c, [
        { field: 'memberId', message: 'Member has assigned conversations, please reassign first', value: assignedConversations.count }
      ])
    }

    await db
      .prepare('DELETE FROM agents WHERE id = ?')
      .bind(memberId)
      .run()

    return successResponse(c, null, 'Member deleted successfully')
  } catch (error) {
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
    const db = c.env.DB
    const invitationId = c.req.param('id')
    
    // 驗證管理員權限
    const authResult = await verifyAdminAuth(c)
    if (authResult.error) return authResult.error

    await db
      .prepare('DELETE FROM invitations WHERE id = ? AND used_at IS NULL')
      .bind(invitationId)
      .run()

    return successResponse(c, null, 'Invitation revoked successfully')
  } catch (error) {
    return handleApiError(error, c)
  }
  */
}