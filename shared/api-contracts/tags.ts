import { defineApiContract } from './core'

export interface Tag {
  id: number
  name: string
  color: string
  description?: string | null
  teamId?: number | null
  teamName?: string | null
  isActive?: boolean | null
  createdBy?: string | null
  createdByName?: string | null
  customerCount?: number
  conversationCount?: number
  assignedAt?: string | null
  assignedBy?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export interface CreateTagRequest {
  name: string
  color?: string
  description?: string
  teamId?: number | null
}

export interface UpdateTagRequest {
  name?: string
  color?: string
  description?: string
  isActive?: boolean
}

export interface TagUsageStats {
  tagInfo: {
    id: number
    name: string
    color: string
  }
  customers: {
    total: number
    byPlatform: {
      line: number
      facebook: number
    }
  }
  conversations: {
    total: number
    active: number
    closed: number
  }
  usageTrend: Array<{
    date: string
    assignments: number
  }>
  topAssigners: Array<{
    name: string
    assignments: number
  }>
}

export interface BulkOperationRequest {
  operation: 'activate' | 'deactivate' | 'update_color'
  tagIds: number[]
  data?: {
    color?: string
  }
}

export interface TagCustomer {
  id: number
  platform: 'line' | 'facebook'
  platform_user_id: string
  display_name: string
  avatar_url?: string | null
  email?: string | null
  phone?: string | null
  created_at: string
  assigned_at: string
  assigned_by?: string | null
  assigned_by_name?: string | null
}

export interface TagConversation {
  id: string
  status: string
  channel: string
  created_at: string
  updated_at: string
  customer_name: string
  customer_avatar: string | null
  customer_platform: string
  assigned_at: string
  assigned_by: string | null
}

export interface PaginatedTagsResponse {
  success: boolean
  data: Tag[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  message: string
}

export interface TagResponse {
  success: boolean
  data: Tag
  message: string
}

export interface TagStatsResponse {
  success: boolean
  data: TagUsageStats
  message: string
}

export interface TagCustomersResponse {
  success: boolean
  data: {
    customers: TagCustomer[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }
  message: string
}

export interface TagConversationsResponse {
  success: boolean
  data: {
    conversations: TagConversation[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }
  message: string
}

export interface TagFilters {
  page?: number
  pageSize?: number
  teamId?: number
  search?: string
  includeGlobal?: boolean
}

export interface TagPaginationParams {
  page?: number
  limit?: number
}

export interface CustomerTagsRequest {
  tagIds: number[]
}

export interface AddTagsToCustomerResponse {
  added: number
  alreadyExists: number
}

export interface SetCustomerTagsResponse {
  totalTags: number
}

export function buildTagQuery<TParams extends object>(params?: TParams): string {
  if (!params) {
    return ''
  }

  const query = new URLSearchParams(
    Object.entries(params)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)])
  ).toString()

  return query ? `?${query}` : ''
}

export const tagContracts = {
  list: defineApiContract<TagFilters | undefined, void, Tag[]>({
    method: 'GET',
    path: params => `/customers/tags/available${buildTagQuery(params)}`
  }),

  create: defineApiContract<Record<string, never>, CreateTagRequest, Tag>({
    method: 'POST',
    path: () => '/tags'
  }),

  getById: defineApiContract<{ id: number }, void, Tag>({
    method: 'GET',
    path: ({ id }) => `/tags/${id}`
  }),

  update: defineApiContract<{ id: number }, UpdateTagRequest, Tag>({
    method: 'PUT',
    path: ({ id }) => `/tags/${id}`
  }),

  delete: defineApiContract<{ id: number }, void, void>({
    method: 'DELETE',
    path: ({ id }) => `/tags/${id}`
  }),

  getUsageStats: defineApiContract<{ id: number }, void, TagUsageStats>({
    method: 'GET',
    path: ({ id }) => `/tags/${id}/stats`
  }),

  bulkOperate: defineApiContract<Record<string, never>, BulkOperationRequest, void>({
    method: 'POST',
    path: () => '/tags/bulk'
  }),

  getCustomerTags: defineApiContract<{ customerId: number }, void, Tag[]>({
    method: 'GET',
    path: ({ customerId }) => `/customers/${customerId}/tags`
  }),

  addTagsToCustomer: defineApiContract<{ customerId: number }, CustomerTagsRequest, AddTagsToCustomerResponse>({
    method: 'POST',
    path: ({ customerId }) => `/customers/${customerId}/tags`
  }),

  removeTagsFromCustomer: defineApiContract<{ customerId: number }, CustomerTagsRequest, void>({
    method: 'DELETE',
    path: ({ customerId }) => `/customers/${customerId}/tags`,
    hasRequestBody: true
  }),

  setCustomerTags: defineApiContract<{ customerId: number }, CustomerTagsRequest, SetCustomerTagsResponse>({
    method: 'PUT',
    path: ({ customerId }) => `/customers/${customerId}/tags`
  }),

  getCustomers: defineApiContract<{ tagId: number; params?: TagPaginationParams }, void, TagCustomersResponse['data']>({
    method: 'GET',
    path: ({ tagId, params }) => `/tags/${tagId}/customers${buildTagQuery(params)}`
  }),

  getConversations: defineApiContract<
    { tagId: number; params?: TagPaginationParams },
    void,
    TagConversationsResponse['data']
  >({
    method: 'GET',
    path: ({ tagId, params }) => `/tags/${tagId}/conversations${buildTagQuery(params)}`
  })
} as const
