// Tags API Client
// 標籤系統 API 介面

import { apiClient } from './base'

export interface Tag {
  id: number
  name: string
  color: string
  description?: string | null
  teamId?: number | null
  teamName?: string | null
  isActive: boolean
  createdBy: string
  createdByName?: string | null
  customerCount?: number
  conversationCount?: number
  createdAt: string
  updatedAt: string
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

/**
 * 獲取標籤列表
 */
export const getTags = async (params?: {
  page?: number
  pageSize?: number
  teamId?: number
  search?: string
  includeGlobal?: boolean
}): Promise<PaginatedTagsResponse> => {
  const queryString = params
    ? `?${  new URLSearchParams(
        Object.entries(params)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, String(value)])
      ).toString()}`
    : ''
  const response = await apiClient.get<Tag[]>(`/customers/tags/available${queryString}`)
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch tags')
  }
  return {
    success: response.success,
    data: response.data,
    pagination: response.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 },
    message: response.message || 'Tags retrieved successfully'
  }
}

/**
 * 創建新標籤
 */
export const createTag = async (data: CreateTagRequest): Promise<TagResponse> => {
  const response = await apiClient.post<Tag>('/tags', data)
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to create tag')
  }
  return {
    success: response.success,
    data: response.data,
    message: response.message || 'Tag created successfully'
  }
}

/**
 * 獲取單一標籤詳情
 */
export const getTagById = async (id: number): Promise<TagResponse> => {
  const response = await apiClient.get<Tag>(`/tags/${id}`)
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch tag')
  }
  return {
    success: response.success,
    data: response.data,
    message: response.message || 'Tag retrieved successfully'
  }
}

/**
 * 更新標籤
 */
export const updateTag = async (id: number, data: UpdateTagRequest): Promise<TagResponse> => {
  const response = await apiClient.put<Tag>(`/tags/${id}`, data)
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to update tag')
  }
  return {
    success: response.success,
    data: response.data,
    message: response.message || 'Tag updated successfully'
  }
}

/**
 * 刪除標籤 (軟刪除)
 */
export const deleteTag = async (id: number): Promise<{ success: boolean; message: string }> => {
  const response = await apiClient.delete<void>(`/tags/${id}`)
  if (!response.success) {
    throw new Error(response.error || 'Failed to delete tag')
  }
  return { success: true, message: 'Tag deleted successfully' }
}

/**
 * 獲取標籤使用統計
 */
export const getTagUsageStats = async (id: number): Promise<TagStatsResponse> => {
  const response = await apiClient.get<TagUsageStats>(`/tags/${id}/stats`)
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch tag stats')
  }
  return {
    success: response.success,
    data: response.data,
    message: response.message || 'Tag stats retrieved successfully'
  }
}

/**
 * 批量操作標籤
 */
export const bulkOperateTags = async (
  data: BulkOperationRequest
): Promise<{ success: boolean; message: string }> => {
  const response = await apiClient.post<void>('/tags/bulk', data)
  if (!response.success) {
    throw new Error(response.error || 'Failed to perform bulk operation')
  }
  return { success: true, message: 'Bulk operation completed successfully' }
}

/**
 * 獲取客戶的標籤
 */
export const getCustomerTags = async (customerId: number): Promise<{ success: boolean; data: Tag[] }> => {
  const response = await apiClient.get<Tag[]>(`/customers/${customerId}/tags`)
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch customer tags')
  }
  return { success: true, data: response.data }
}

/**
 * 為客戶添加標籤
 */
export const addTagsToCustomer = async (
  customerId: number,
  tagIds: number[]
): Promise<{ success: boolean; message: string }> => {
  const response = await apiClient.post<void>(`/customers/${customerId}/tags`, { tagIds })
  if (!response.success) {
    throw new Error(response.error || 'Failed to add tags to customer')
  }
  return { success: true, message: 'Tags added successfully' }
}

/**
 * 從客戶移除標籤
 */
export const removeTagsFromCustomer = async (
  customerId: number,
  tagIds: number[]
): Promise<{ success: boolean; message: string }> => {
  const response = await apiClient.request<void>(
    'DELETE',
    `/customers/${customerId}/tags`,
    { tagIds }
  )
  if (!response.success) {
    throw new Error(response.error || 'Failed to remove tags from customer')
  }
  return { success: true, message: 'Tags removed successfully' }
}

/**
 * 設置客戶標籤 (替換所有)
 */
export const setCustomerTags = async (
  customerId: number,
  tagIds: number[]
): Promise<{ success: boolean; message: string }> => {
  const response = await apiClient.put<void>(`/customers/${customerId}/tags`, { tagIds })
  if (!response.success) {
    throw new Error(response.error || 'Failed to set customer tags')
  }
  return { success: true, message: 'Tags set successfully' }
}

/**
 * 獲取標籤的客戶列表
 */
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
  assigned_by: string
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

export const getTagCustomers = async (
  tagId: number,
  params?: {
    page?: number
    limit?: number
  }
): Promise<TagCustomersResponse> => {
  const queryString = params
    ? `?${new URLSearchParams(
        Object.entries(params)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, String(value)])
      ).toString()}`
    : ''
  const response = await apiClient.get<{
    customers: TagCustomer[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }>(`/tags/${tagId}/customers${queryString}`)
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch tag customers')
  }
  return {
    success: response.success,
    data: response.data,
    message: response.message || 'Tag customers retrieved successfully'
  }
}

/**
 * 獲取標籤的對話列表
 */
export const getTagConversations = async (
  tagId: number,
  params?: { page?: number; limit?: number }
): Promise<TagConversationsResponse> => {
  const queryString = params
    ? `?${new URLSearchParams(
        Object.entries(params)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, String(value)])
      ).toString()}`
    : ''
  const response = await apiClient.get<{
    conversations: TagConversation[]
    pagination: { page: number; limit: number; total: number; totalPages: number }
  }>(`/tags/${tagId}/conversations${queryString}`)
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch tag conversations')
  }
  return {
    success: response.success,
    data: response.data,
    message: response.message || 'Tag conversations retrieved successfully'
  }
}
