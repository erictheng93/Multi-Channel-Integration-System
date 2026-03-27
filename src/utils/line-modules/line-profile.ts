import { createContextLogger } from '../logger';
import { LINE_API, buildLineApiUrl } from '../../config/external-apis';

const log = createContextLogger('LineUtils');

/**
 * 獲取 LINE 用戶資訊
 */
export async function getLineUserProfile(
  accessToken: string,
  userId: string
): Promise<{
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
} | null> {
  try {
    const response = await fetch(buildLineApiUrl(LINE_API.endpoints.profile, { userId }), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error('LINE Profile API error', { status: response.status, errorText });
      return null;
    }

    const profile = await response.json();
    log.info('LINE user profile retrieved successfully', { displayName: (profile as { displayName: string }).displayName, userId });
    return profile as { userId: string; displayName: string; pictureUrl?: string; statusMessage?: string; };
  } catch (error) {
    log.error('Failed to get LINE user profile', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * 獲取群組或聊天室成員資訊
 */
export async function getLineGroupMemberProfile(
  accessToken: string,
  groupId: string,
  userId: string
): Promise<{
  userId: string;
  displayName: string;
  pictureUrl?: string;
} | null> {
  try {
    const response = await fetch(buildLineApiUrl(LINE_API.endpoints.groupMember, { groupId, userId }), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error('LINE Group Member API error', { status: response.status, errorText });
      return null;
    }

    const profile = await response.json();
    log.info('LINE group member profile retrieved successfully', { displayName: (profile as { displayName: string }).displayName, userId });
    return profile as { userId: string; displayName: string; pictureUrl?: string; statusMessage?: string; };
  } catch (error) {
    log.error('Failed to get LINE group member profile', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}
