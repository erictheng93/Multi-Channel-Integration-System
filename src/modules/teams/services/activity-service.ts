// Activity Service for Teams - Updated to use modularized Activities
// 團隊活動記錄服務 - 更新為使用模組化的活動系統

import { TeamActivityService } from '@modules/activities';

// Re-export the modularized TeamActivityService with alias for backward compatibility
export { TeamActivityService } from '../../activities'

// For backward compatibility, create an alias with the original class structure
export class TeamActivityService_Legacy {
  private teamActivityService: TeamActivityService;

  constructor(database: D1Database) {
    this.teamActivityService = new TeamActivityService(database);
  }

  // Delegate all methods to the modularized service
  async logTeamCreate(params: {
    userId: string;
    userName: string;
    userRole: string;
    teamId: number;
    teamName: string;
    description?: string;
  }) {
    return await this.teamActivityService.logTeamCreate(params);
  }

  async logTeamUpdate(params: {
    userId: string;
    userName: string;
    userRole: string;
    teamId: number;
    teamName: string;
    updates: unknown;
  }) {
    return await this.teamActivityService.logTeamUpdate(params);
  }

  async logTeamDelete(params: {
    userId: string;
    userName: string;
    userRole: string;
    teamId: number;
    teamName: string;
  }) {
    return await this.teamActivityService.logTeamDelete(params);
  }

  async logMemberAdd(params: {
    userId: string;
    userName: string;
    userRole: string;
    teamId: number;
    teamName: string;
    addedAgentId: string;
    addedAgentName: string;
  }) {
    return await this.teamActivityService.logMemberAdd(params);
  }

  async logMemberRemove(params: {
    userId: string;
    userName: string;
    userRole: string;
    teamId: number;
    teamName: string;
    removedAgentId: string;
    removedAgentName: string;
  }) {
    return await this.teamActivityService.logMemberRemove(params);
  }

  async logQRCodeGenerate(params: {
    userId: string;
    userName: string;
    userRole: string;
    teamId: number;
    teamName: string;
    campaignName?: string;
  }) {
    return await this.teamActivityService.logQRCodeGenerate(params);
  }

  static get ACTIONS() {
    return TeamActivityService.ACTIONS;
  }

  static get RESOURCE_TYPES() {
    return TeamActivityService.RESOURCE_TYPES;
  }
}