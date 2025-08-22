// 平台適配器 - 統一不同平台的訊息格式
export interface UnifiedMessage {
  platform: 'line' | 'facebook' | 'instagram' | 'whatsapp';
  userId: string;
  messageId: string;
  content: string;
  messageType: 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker';
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface UnifiedUser {
  platform: string;
  platformUserId: string;
  displayName?: string;
  avatarUrl?: string;
  metadata?: Record<string, any>;
}

export abstract class PlatformAdapter {
  abstract platform: string;
  
  // 將平台原始訊息轉換為統一格式
  abstract normalizeMessage(rawMessage: any): UnifiedMessage;
  
  // 將平台原始用戶資料轉換為統一格式
  abstract normalizeUser(rawUser: any): UnifiedUser;
  
  // 發送訊息到平台
  abstract sendMessage(userId: string, content: string, messageType?: string): Promise<boolean>;
  
  // 驗證 Webhook 簽名
  abstract verifyWebhook(signature: string, body: string): Promise<boolean>;
}

// Line 平台適配器
export class LineAdapter extends PlatformAdapter {
  platform = 'line';
  
  constructor(private channelSecret: string, private accessToken: string) {
    super();
  }
  
  normalizeMessage(lineEvent: any): UnifiedMessage {
    return {
      platform: 'line',
      userId: lineEvent.source.userId,
      messageId: lineEvent.message.id,
      content: lineEvent.message.text || '',
      messageType: this.mapLineMessageType(lineEvent.message.type),
      timestamp: new Date(lineEvent.timestamp),
      metadata: {
        replyToken: lineEvent.replyToken,
        originalEvent: lineEvent
      }
    };
  }
  
  normalizeUser(lineProfile: any): UnifiedUser {
    return {
      platform: 'line',
      platformUserId: lineProfile.userId,
      displayName: lineProfile.displayName,
      avatarUrl: lineProfile.pictureUrl,
      metadata: {
        statusMessage: lineProfile.statusMessage
      }
    };
  }
  
  async sendMessage(userId: string, content: string, messageType = 'text'): Promise<boolean> {
    // Line Messaging API 實作
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: userId,
        messages: [{
          type: messageType,
          text: content
        }]
      })
    });
    
    return response.ok;
  }
  
  async verifyWebhook(signature: string, body: string): Promise<boolean> {
    // Line Webhook 驗證邏輯 - 使用 Web Crypto API
    try {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(this.channelSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      
      const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
      const hash = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
      return hash === signature;
    } catch (error) {
      console.error('Line webhook verification failed:', error);
      return false;
    }
  }
  
  private mapLineMessageType(lineType: string): 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker' {
    const typeMap: Record<string, 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker'> = {
      'text': 'text',
      'image': 'image',
      'video': 'video',
      'audio': 'audio',
      'file': 'file',
      'location': 'location',
      'sticker': 'sticker'
    };
    return typeMap[lineType] || 'text';
  }
}

// Facebook Messenger 適配器
export class FacebookAdapter extends PlatformAdapter {
  platform = 'facebook';
  
  constructor(private appSecret: string, private pageAccessToken: string) {
    super();
  }
  
  normalizeMessage(fbMessage: any): UnifiedMessage {
    const message = fbMessage.message;
    return {
      platform: 'facebook',
      userId: fbMessage.sender.id,
      messageId: message.mid,
      content: message.text || '',
      messageType: this.mapFacebookMessageType(message),
      timestamp: new Date(fbMessage.timestamp),
      metadata: {
        originalMessage: fbMessage
      }
    };
  }
  
  normalizeUser(fbUser: any): UnifiedUser {
    return {
      platform: 'facebook',
      platformUserId: fbUser.id,
      displayName: `${fbUser.first_name} ${fbUser.last_name}`,
      avatarUrl: fbUser.profile_pic,
      metadata: {
        locale: fbUser.locale,
        timezone: fbUser.timezone
      }
    };
  }
  
  async sendMessage(userId: string, content: string, _messageType?: string): Promise<boolean> {
    return this.sendTextMessage(userId, content);
  }

  async sendTextMessage(userId: string, text: string): Promise<boolean> {
    const response = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${this.pageAccessToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipient: { id: userId },
        message: { text }
      })
    });
    
    return response.ok;
  }

  async sendImageMessage(userId: string, imageUrl: string): Promise<boolean> {
    const response = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${this.pageAccessToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipient: { id: userId },
        message: {
          attachment: {
            type: 'image',
            payload: { url: imageUrl }
          }
        }
      })
    });
    
    return response.ok;
  }

  async sendVideoMessage(userId: string, videoUrl: string): Promise<boolean> {
    const response = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${this.pageAccessToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipient: { id: userId },
        message: {
          attachment: {
            type: 'video',
            payload: { url: videoUrl }
          }
        }
      })
    });
    
    return response.ok;
  }

  async sendAudioMessage(userId: string, audioUrl: string): Promise<boolean> {
    const response = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${this.pageAccessToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipient: { id: userId },
        message: {
          attachment: {
            type: 'audio',
            payload: { url: audioUrl }
          }
        }
      })
    });
    
    return response.ok;
  }

  async sendFileMessage(userId: string, fileUrl: string, _filename?: string): Promise<boolean> {
    const response = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${this.pageAccessToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipient: { id: userId },
        message: {
          attachment: {
            type: 'file',
            payload: { 
              url: fileUrl,
              is_reusable: true
            }
          }
        }
      })
    });
    
    return response.ok;
  }

  async sendLocationMessage(userId: string, latitude: number, longitude: number): Promise<boolean> {
    const response = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${this.pageAccessToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipient: { id: userId },
        message: {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'generic',
              elements: [{
                title: 'Location',
                subtitle: `Lat: ${latitude}, Lng: ${longitude}`,
                default_action: {
                  type: 'web_url',
                  url: `https://www.google.com/maps?q=${latitude},${longitude}`
                }
              }]
            }
          }
        }
      })
    });
    
    return response.ok;
  }
  
  async verifyWebhook(signature: string, body: string): Promise<boolean> {
    // Facebook Webhook 驗證邏輯 - 使用 Web Crypto API
    try {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(this.appSecret),
        { name: 'HMAC', hash: 'SHA-1' },
        false,
        ['sign']
      );
      
      const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
      const hashArray = new Uint8Array(signatureBuffer);
      const hash = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
      return `sha1=${hash}` === signature;
    } catch (error) {
      console.error('Facebook webhook verification failed:', error);
      return false;
    }
  }
  
  private mapFacebookMessageType(message: any): 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker' {
    if (message.text) return 'text';
    if (message.attachments) {
      const type = message.attachments[0].type;
      const validTypes: ('text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker')[] = 
        ['text', 'image', 'video', 'audio', 'file', 'location', 'sticker'];
      return validTypes.includes(type) ? type : 'file';
    }
    return 'text';
  }
}