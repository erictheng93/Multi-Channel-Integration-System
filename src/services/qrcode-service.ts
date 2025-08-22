// QR Code 生成與管理服務
import type {
  QRCodeMetadata,
  QRFollowEvent,
  CustomerCreationData,
  ConversationCreationData
} from '../types/services';

export interface QRCodeConfig {
  teamId: number;
  campaignName?: string;
  expiresAt?: Date;
  maxUses?: number;
  metadata?: QRCodeMetadata;
}

export interface QRCodeInfo {
  id: string;
  teamId: number;
  token: string;
  lineUrl: string;
  qrCodeImageUrl: string;
  campaignName?: string;
  usageCount: number;
  maxUses?: number;
  isActive: boolean;
  expiresAt?: Date;
  createdAt: Date;
}

export class QRCodeService {
  private static readonly LINE_BOT_ID = '@your_bot_id'; // 將在實際使用時通過參數傳遞
  private static readonly QR_API_BASE = 'https://api.qrserver.com/v1/create-qr-code/';

  // 為團隊生成 QR Code
  static async generateTeamQRCode(config: QRCodeConfig): Promise<QRCodeInfo> {
    // 生成唯一的追蹤 token
    const token = this.generateTrackingToken(config.teamId);
    
    // 構建 Line 加好友連結
    const lineUrl = `https://line.me/R/ti/p/${this.LINE_BOT_ID}?ref=${token}`;
    
    // 生成 QR Code 圖片
    const qrCodeImageUrl = await this.generateQRCodeImage(lineUrl);
    
    // 儲存到資料庫
    const qrCodeInfo: QRCodeInfo = {
      id: crypto.randomUUID(),
      teamId: config.teamId,
      token,
      lineUrl,
      qrCodeImageUrl,
      campaignName: config.campaignName || '',
      usageCount: 0,
      maxUses: config.maxUses || 0,
      isActive: true,
      expiresAt: config.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天後過期
      createdAt: new Date()
    };

    await this.saveQRCodeToDB(qrCodeInfo);
    
    // 更新團隊的 QR Code 資訊
    await this.updateTeamQRCode(config.teamId, token, qrCodeImageUrl);
    
    return qrCodeInfo;
  }

  // 處理通過 QR Code 加入的用戶
  static async handleQRCodeFollow(followEvent: QRFollowEvent): Promise<{ teamId?: number; autoAssigned: boolean }> {
    const referralParam = (followEvent as any).follow?.param;
    
    if (!referralParam) {
      return { autoAssigned: false };
    }

    // 解析追蹤 token
    const qrCodeInfo = await this.getQRCodeByToken(referralParam);
    
    if (!qrCodeInfo || !qrCodeInfo.isActive) {
      return { autoAssigned: false };
    }

    // 檢查是否過期
    if (qrCodeInfo.expiresAt && new Date() > qrCodeInfo.expiresAt) {
      await this.deactivateQRCode(qrCodeInfo.token);
      return { autoAssigned: false };
    }

    // 檢查使用次數限制
    if (qrCodeInfo.maxUses && qrCodeInfo.usageCount >= qrCodeInfo.maxUses) {
      await this.deactivateQRCode(qrCodeInfo.token);
      return { autoAssigned: false };
    }

    // 增加使用次數
    await this.incrementQRCodeUsage(qrCodeInfo.token);

    // 自動指派給對應團隊
    const userId = followEvent.source.userId;
    await this.autoAssignCustomerToTeam(userId, qrCodeInfo.teamId, referralParam);

    return { 
      teamId: qrCodeInfo.teamId, 
      autoAssigned: true 
    };
  }

  // 生成追蹤 token
  private static generateTrackingToken(teamId: number): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `team${teamId}_${timestamp}_${random}`;
  }

  // 生成 QR Code 圖片
  private static async generateQRCodeImage(url: string): Promise<string> {
    const qrParams = new URLSearchParams({
      size: '300x300',
      data: url,
      format: 'png',
      margin: '10'
    });
    
    const qrCodeUrl = `${this.QR_API_BASE}?${qrParams.toString()}`;
    
    // 可以選擇將圖片上傳到 Cloudflare R2 並返回永久連結
    // 或直接返回第三方 API 連結
    return qrCodeUrl;
  }

  // 自動指派客戶到團隊
  private static async autoAssignCustomerToTeam(
    platformUserId: string, 
    teamId: number, 
    source: string
  ): Promise<void> {
    // 1. 查找或創建客戶記錄
    let customer = await this.findCustomerByPlatformId('line', platformUserId);
    
    if (!customer) {
      // 獲取 Line 用戶資料
      const lineProfile = await this.getLineUserProfile(platformUserId);
      
      customer = await this.createCustomer({
        platform: 'line',
        platformUserId,
        displayName: lineProfile?.displayName || 'LINE User',
        avatarUrl: lineProfile?.pictureUrl || '',
        sourceTeamId: teamId,
        metadata: { qrCodeSource: source }
      });
    }
    
    if (customer) {
      // 更新來源團隊
      await this.updateCustomerSourceTeam(customer.id, teamId);

      // 2. 創建或更新對話
      let conversation = await this.findActiveConversation(customer.id);
      
      if (!conversation) {
        conversation = await this.createConversation({
          customerId: customer.id,
          assignedTeamId: teamId,
          status: 'active',
          metadata: { autoAssigned: true, qrCodeSource: source }
        });
      } else {
        // 如果已有對話但未指派，則指派給該團隊
        if (!conversation.assignedTeamId) {
          await this.assignConversationToTeam(conversation.id, teamId);
        }
      }

      // 3. 記錄自動指派日誌
      await this.logAutoAssignment(customer.id, teamId, source);
    }
  }

  // 獲取團隊的所有 QR Code
  static async getTeamQRCodes(_teamId: number): Promise<QRCodeInfo[]> {
    // 從資料庫查詢該團隊的所有 QR Code
    return []; // 實際實作中從資料庫查詢
  }

  // 停用 QR Code
  static async deactivateQRCode(_token: string): Promise<void> {
    // 更新資料庫中的 QR Code 狀態
  }

  // 獲取 QR Code 使用統計
  static async getQRCodeStats(_teamId: number, _dateRange?: { start: Date; end: Date }) {
    return {
      totalScans: 0,
      newCustomers: 0,
      conversionRate: 0,
      topPerformingCodes: []
    };
  }

  // 私有方法 - 實際實作中需要連接資料庫
  private static async saveQRCodeToDB(_qrCodeInfo: QRCodeInfo): Promise<void> {
    // 儲存到資料庫
  }

  private static async updateTeamQRCode(_teamId: number, _token: string, _qrCodeUrl: string): Promise<void> {
    // 更新團隊表中的 QR Code 資訊
  }

  private static async getQRCodeByToken(_token: string): Promise<QRCodeInfo | null> {
    // 從資料庫查詢 QR Code 資訊
    return null;
  }

  private static async incrementQRCodeUsage(_token: string): Promise<void> {
    // 增加使用次數
  }

  private static async findCustomerByPlatformId(_platform: string, _platformUserId: string): Promise<{ id: number } | null> {
    // 查找客戶
    return null;
  }

  private static async getLineUserProfile(_userId: string): Promise<{ displayName?: string; pictureUrl?: string } | null> {
    // 獲取 Line 用戶資料
    return null;
  }

  private static async createCustomer(_customerData: CustomerCreationData): Promise<{ id: number } | null> {
    // 創建客戶
    return null;
  }

  private static async updateCustomerSourceTeam(_customerId: number, _teamId: number): Promise<void> {
    // 更新客戶來源團隊
  }

  private static async findActiveConversation(_customerId: number): Promise<{ id: number; assignedTeamId?: number } | null> {
    // 查找活躍對話
    return null;
  }

  private static async createConversation(_conversationData: ConversationCreationData): Promise<{ id: number } | null> {
    // 創建對話
    return null;
  }

  private static async assignConversationToTeam(_conversationId: number, _teamId: number): Promise<void> {
    // 指派對話到團隊
  }

  private static async logAutoAssignment(_customerId: number, _teamId: number, _source: string): Promise<void> {
    // 記錄自動指派日誌
  }
}