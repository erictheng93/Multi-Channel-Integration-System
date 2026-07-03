export type BroadcastContentType = 'text';
export type BroadcastMatchMode = 'any' | 'all';
export type BroadcastStatus = 'draft' | 'sending' | 'completed' | 'partial_failed' | 'failed';
export type BroadcastRecipientStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export type BroadcastRecipientErrorReason =
  | 'platform_not_supported_phase1'
  | 'no_channel_credentials'
  | 'line_api_failed'
  | 'quota_insufficient';

export interface BroadcastAudienceMember {
  customerId: number;
  platform: string;
  platformUserId: string;
  resolvedTeamId: number | null;
}

export interface BroadcastAudiencePreview {
  total: number;
  byPlatform: Record<string, number> & {
    line: number;
    facebook: number;
  };
  sendable: number;
  skipped: Array<{
    reason: BroadcastRecipientErrorReason;
    count: number;
  }>;
}

export interface CreateBroadcastInput {
  title: string;
  content: string;
  tagIds: number[];
}

export interface BroadcastRecord {
  id: string;
  title: string;
  contentType: BroadcastContentType;
  content: string;
  tagIds: number[];
  matchMode: BroadcastMatchMode;
  status: BroadcastStatus;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  createdBy: string;
  sentAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  deletedAt: string | null;
}

export interface BroadcastListResult {
  items: BroadcastRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface BroadcastRecipientDetail {
  id: number;
  broadcastId: string;
  customerId: number | null;
  platform: string;
  platformUserId: string;
  resolvedTeamId: number | null;
  status: BroadcastRecipientStatus;
  errorReason: BroadcastRecipientErrorReason | null;
  sentAt: string | null;
  createdAt: string | null;
  customerDisplayName: string | null;
  customerAvatarUrl: string | null;
}

export interface BroadcastRecipientListResult {
  items: BroadcastRecipientDetail[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface BroadcastSendStats {
  broadcastId: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  status: BroadcastStatus;
}

export type BroadcastServiceErrorCode =
  | 'TAG_NOT_FOUND'
  | 'EMPTY_AUDIENCE'
  | 'INVALID_BROADCAST_INPUT'
  | 'PHASE1_SINGLE_TAG_ONLY'
  | 'BROADCAST_NOT_FOUND'
  | 'INVALID_BROADCAST_STATUS'
  | 'LINE_RECIPIENT_LIMIT_EXCEEDED'
  | 'QUOTA_INSUFFICIENT';

export class BroadcastServiceError extends Error {
  constructor(
    public readonly code: BroadcastServiceErrorCode,
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'BroadcastServiceError';
  }
}
