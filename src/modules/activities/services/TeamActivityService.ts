// Activities Module - Team Activity Service
// 活動模組 - 團隊活動記錄服務

import { ActivityService } from '@modules/activities/services/ActivityService'
import { ACTIVITY_ACTIONS } from '@modules/activities/constants/actions'
import { RESOURCE_TYPES } from '@modules/activities/constants/resources'
import {
  TeamCreateActivityParams,
  TeamUpdateActivityParams,
  MemberActivityParams,
  QRCodeActivityParams,
  ActivityLog
} from '../types/interfaces'
import { createContextLogger } from '@/utils/logger'

const log = createContextLogger('TeamActivityService')

export class TeamActivityService {
  private activityService: ActivityService

  constructor(database: D1Database) {
    this.activityService = new ActivityService(database)
  }

  /**
   * 記錄團隊創建活動
   */
  async logTeamCreate(params: TeamCreateActivityParams): Promise<ActivityLog | null> {
    return await this.activityService.logActivity({
      userId: params.userId,
      userName: params.userName,
      userRole: params.userRole,
      action: ACTIVITY_ACTIONS.TEAM_CREATE,
      resourceType: RESOURCE_TYPES.TEAM,
      resourceId: params.teamId.toString(),
      details: {
        teamName: params.teamName,
        ...(params.description && { description: params.description })
      }
    })
  }

  /**
   * 記錄團隊更新活動
   */
  async logTeamUpdate(params: TeamUpdateActivityParams): Promise<ActivityLog | null> {
    return await this.activityService.logActivity({
      userId: params.userId,
      userName: params.userName,
      userRole: params.userRole,
      action: ACTIVITY_ACTIONS.TEAM_UPDATE,
      resourceType: RESOURCE_TYPES.TEAM,
      resourceId: params.teamId.toString(),
      details: {
        teamName: params.teamName,
        updates: params.updates
      }
    })
  }

  /**
   * 記錄團隊刪除活動
   */
  async logTeamDelete(params: TeamCreateActivityParams): Promise<ActivityLog | null> {
    return await this.activityService.logActivity({
      userId: params.userId,
      userName: params.userName,
      userRole: params.userRole,
      action: ACTIVITY_ACTIONS.TEAM_DELETE,
      resourceType: RESOURCE_TYPES.TEAM,
      resourceId: params.teamId.toString(),
      details: {
        teamName: params.teamName
      }
    })
  }

  /**
   * 記錄成員加入活動
   */
  async logMemberAdd(params: MemberActivityParams): Promise<ActivityLog | null> {
    if (!params.addedAgentId || !params.addedAgentName) {
      log.warn('Missing agent info for member add')
      return null
    }

    return await this.activityService.logActivity({
      userId: params.userId,
      userName: params.userName,
      userRole: params.userRole,
      action: ACTIVITY_ACTIONS.MEMBER_ADD,
      resourceType: RESOURCE_TYPES.TEAM,
      resourceId: params.teamId.toString(),
      details: {
        teamName: params.teamName,
        addedAgentId: params.addedAgentId,
        addedAgentName: params.addedAgentName
      }
    })
  }

  /**
   * 記錄成員移除活動
   */
  async logMemberRemove(params: MemberActivityParams): Promise<ActivityLog | null> {
    if (!params.removedAgentId || !params.removedAgentName) {
      log.warn('Missing agent info for member remove')
      return null
    }

    return await this.activityService.logActivity({
      userId: params.userId,
      userName: params.userName,
      userRole: params.userRole,
      action: ACTIVITY_ACTIONS.MEMBER_REMOVE,
      resourceType: RESOURCE_TYPES.TEAM,
      resourceId: params.teamId.toString(),
      details: {
        teamName: params.teamName,
        removedAgentId: params.removedAgentId,
        removedAgentName: params.removedAgentName
      }
    })
  }

  /**
   * 記錄 QR 碼生成活動
   */
  async logQRCodeGenerate(params: QRCodeActivityParams): Promise<ActivityLog | null> {
    return await this.activityService.logActivity({
      userId: params.userId,
      userName: params.userName,
      userRole: params.userRole,
      action: ACTIVITY_ACTIONS.QR_CODE_GENERATE,
      resourceType: RESOURCE_TYPES.QR_CODE,
      resourceId: params.teamId.toString(),
      details: {
        teamName: params.teamName,
        ...(params.campaignName && { campaignName: params.campaignName })
      }
    })
  }

  /**
   * 記錄團隊邀請活動
   */
  async logTeamInvite(params: {
    userId: string
    userName: string
    userRole: string
    teamId: number
    teamName: string
    invitedEmail: string
    invitedRole: string
  }): Promise<ActivityLog | null> {
    return await this.activityService.logActivity({
      userId: params.userId,
      userName: params.userName,
      userRole: params.userRole,
      action: ACTIVITY_ACTIONS.TEAM_INVITE,
      resourceType: RESOURCE_TYPES.TEAM,
      resourceId: params.teamId.toString(),
      details: {
        teamName: params.teamName,
        invitedEmail: params.invitedEmail,
        invitedRole: params.invitedRole
      }
    })
  }

  /**
   * 記錄成員權限更新活動
   */
  async logMemberUpdate(params: {
    userId: string
    userName: string
    userRole: string
    teamId: number
    teamName: string
    updatedAgentId: string
    updatedAgentName: string
    oldRole: string
    newRole: string
  }): Promise<ActivityLog | null> {
    return await this.activityService.logActivity({
      userId: params.userId,
      userName: params.userName,
      userRole: params.userRole,
      action: ACTIVITY_ACTIONS.TEAM_MEMBER_UPDATE,
      resourceType: RESOURCE_TYPES.TEAM,
      resourceId: params.teamId.toString(),
      details: {
        teamName: params.teamName,
        updatedAgentId: params.updatedAgentId,
        updatedAgentName: params.updatedAgentName,
        oldRole: params.oldRole,
        newRole: params.newRole
      }
    })
  }

  /**
   * 獲取團隊活動記錄
   */
  async getTeamActivities(teamId: number, options?: {
    page?: number
    pageSize?: number
    days?: number
  }) {
    const params: any = {
      resourceType: RESOURCE_TYPES.TEAM,
      resourceId: teamId.toString(),
      page: options?.page || 1,
      pageSize: options?.pageSize || 50
    }

    // 如果指定了天數，添加日期過濾
    if (options?.days) {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - options.days)
      params.startDate = startDate.toISOString()
    }

    return await this.activityService.getActivities(params)
  }

  /**
   * 獲取團隊成員活動統計
   */
  async getTeamMemberStats(teamId: number, days = 30) {
    // 先獲取團隊活動
    const teamActivities = await this.getTeamActivities(teamId, { days, pageSize: 1000 })

    // 按用戶分組統計
    const memberStats: Record<string, {
      userId: string
      userName: string
      userRole: string
      totalActions: number
      actions: Record<string, number>
    }> = {}

    for (const activity of teamActivities.items) {
      const userId = activity.userId
      if (!memberStats[userId]) {
        memberStats[userId] = {
          userId: activity.userId,
          userName: activity.userName,
          userRole: activity.userRole,
          totalActions: 0,
          actions: {}
        }
      }

      memberStats[userId].totalActions += 1
      memberStats[userId].actions[activity.action] =
        (memberStats[userId].actions[activity.action] || 0) + 1
    }

    return Object.values(memberStats)
      .sort((a, b) => b.totalActions - a.totalActions)
  }

  // 導出常數供外部使用
  static get ACTIONS() {
    return {
      ...ACTIVITY_ACTIONS,
      MEMBER_ADD: ACTIVITY_ACTIONS.MEMBER_ADD,
      MEMBER_REMOVE: ACTIVITY_ACTIONS.MEMBER_REMOVE,
      QR_CODE_GENERATE: ACTIVITY_ACTIONS.QR_CODE_GENERATE
    }
  }

  static get RESOURCE_TYPES() {
    return RESOURCE_TYPES
  }
}