// External API response types
// Provides strict typing for LINE, Facebook, and other external API responses

// LINE API Types
export interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
  language?: string;
}

export interface LineWebhookInfo {
  endpoint: string;
  active: boolean;
}

export interface LineBotInfo {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  chatMode: string;
  markAsReadMode: string;
}

export interface LineTokenInfo {
  scope: string;
  client_id: string;
  expires_in: number;
}

// Facebook API Types
export interface FacebookProfile {
  id: string;
  first_name?: string;
  last_name?: string;
  profile_pic?: string;
  locale?: string;
  timezone?: number;
}

export interface FacebookPageInfo {
  id: string;
  name: string;
  access_token?: string;
  category?: string;
  category_list?: Array<{
    id: string;
    name: string;
  }>;
}

export interface FacebookWebhookInfo {
  object: string;
  callback_url: string;
  verify_token: string;
  fields: string[];
}

// Generic API response wrapper
export interface ExternalApiResponse<T = unknown> {
  data?: T;
  error?: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

// LINE specific API responses
export interface LineApiResponse<T = unknown> extends ExternalApiResponse<T> {
  message?: string;
}

// Facebook specific API responses  
export interface FacebookApiResponse<T = unknown> extends ExternalApiResponse<T> {
  paging?: {
    cursors: {
      before: string;
      after: string;
    };
    next?: string;
    previous?: string;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Type guards for external API responses
export function isLineProfile(obj: unknown): obj is LineProfile {
  return isRecord(obj) && typeof obj.userId === 'string' && typeof obj.displayName === 'string';
}

export function isFacebookProfile(obj: unknown): obj is FacebookProfile {
  return isRecord(obj) && typeof obj.id === 'string';
}

export function isLineBotInfo(obj: unknown): obj is LineBotInfo {
  return isRecord(obj) && typeof obj.userId === 'string' && typeof obj.displayName === 'string';
}

export function isFacebookPageInfo(obj: unknown): obj is FacebookPageInfo {
  return isRecord(obj) && typeof obj.id === 'string' && typeof obj.name === 'string';
}

export function isLineTokenInfo(obj: unknown): obj is LineTokenInfo {
  return isRecord(obj) && typeof obj.expires_in === 'number';
}

export function hasApiError(response: unknown): response is { error: { message: string } } {
  return (
    isRecord(response) &&
    isRecord(response.error) &&
    typeof response.error.message === 'string'
  );
}

export function isLineWebhookInfo(obj: unknown): obj is LineWebhookInfo {
  return isRecord(obj) && typeof obj.active === 'boolean';
}
