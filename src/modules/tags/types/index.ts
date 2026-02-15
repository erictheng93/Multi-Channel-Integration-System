// src/modules/tags/types/index.ts
// Tag module type definitions

import type { Context } from 'hono';
import type { Bindings } from '@/types';

/** Tag handler context type */
export type TagContext = Context<{ Bindings: Bindings }>;

/** Tag list query parameters */
export interface TagListQuery {
  page?: string;
  pageSize?: string;
  search?: string;
}

/** Tag create request body */
export interface TagCreateRequest {
  name: string;
  color?: string;
  description?: string;
  teamId?: string | null;
}

/** Tag update request body */
export interface TagUpdateRequest {
  name?: string;
  color?: string;
  description?: string;
  isActive?: boolean;
}

/** Tag bulk operation request body */
export interface TagBulkOperationRequest {
  operation: 'activate' | 'deactivate' | 'update_color';
  tagIds: (string | number)[];
  data?: {
    color?: string;
  };
}

/** Tag response shape (camelCase) */
export interface TagResponse {
  id: string | number;
  name: string;
  color: string;
  description: string | null;
  teamId: string | null;
  teamName?: string | null;
  isActive: boolean;
  createdBy: string;
  createdByName?: string | null;
  customerCount: number;
  conversationCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Tag usage statistics response */
export interface TagUsageStatsResponse {
  tagInfo: {
    id: string | number;
    name: string;
    color: string;
  };
  customers: {
    total: number;
    byPlatform: {
      line: number;
      facebook: number;
    };
  };
  conversations: {
    total: number;
    active: number;
    closed: number;
  };
  usageTrend: Array<{
    date: string;
    assignments: number;
  }>;
  topAssigners: Array<{
    name: string;
    assignments: number;
  }>;
}

/** Tag customers response */
export interface TagCustomersResponse {
  customers: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
