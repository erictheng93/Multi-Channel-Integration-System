// Tags API Client
// 標籤系統 API 介面

import {
  tagContracts,
  type BulkOperationRequest,
  type CreateTagRequest,
  type PaginatedTagsResponse,
  type Tag,
  type TagConversationsResponse,
  type TagCustomersResponse,
  type TagResponse,
  type TagStatsResponse,
  type UpdateTagRequest
} from '@shared/api-contracts'
import { callApiContract } from './contract-client'

export type {
  BulkOperationRequest,
  CreateTagRequest,
  PaginatedTagsResponse,
  Tag,
  TagConversation,
  TagConversationsResponse,
  TagCustomer,
  TagCustomersResponse,
  TagResponse,
  TagStatsResponse,
  TagUsageStats,
  UpdateTagRequest
} from '@shared/api-contracts'

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
  const response = await callApiContract(tagContracts.list, params)
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
  const response = await callApiContract(tagContracts.create, {}, data)
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
  const response = await callApiContract(tagContracts.getById, { id })
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
  const response = await callApiContract(tagContracts.update, { id }, data)
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
  const response = await callApiContract(tagContracts.delete, { id })
  if (!response.success) {
    throw new Error(response.error || 'Failed to delete tag')
  }
  return { success: true, message: 'Tag deleted successfully' }
}

/**
 * 獲取標籤使用統計
 */
export const getTagUsageStats = async (id: number): Promise<TagStatsResponse> => {
  const response = await callApiContract(tagContracts.getUsageStats, { id })
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
  const response = await callApiContract(tagContracts.bulkOperate, {}, data)
  if (!response.success) {
    throw new Error(response.error || 'Failed to perform bulk operation')
  }
  return { success: true, message: 'Bulk operation completed successfully' }
}

/**
 * 獲取客戶的標籤
 */
export const getCustomerTags = async (customerId: number): Promise<{ success: boolean; data: Tag[] }> => {
  const response = await callApiContract(tagContracts.getCustomerTags, { customerId })
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
  const response = await callApiContract(tagContracts.addTagsToCustomer, { customerId }, { tagIds })
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
  const response = await callApiContract(tagContracts.removeTagsFromCustomer, { customerId }, { tagIds })
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
  const response = await callApiContract(tagContracts.setCustomerTags, { customerId }, { tagIds })
  if (!response.success) {
    throw new Error(response.error || 'Failed to set customer tags')
  }
  return { success: true, message: 'Tags set successfully' }
}

/**
 * 獲取標籤的客戶列表
 */
export const getTagCustomers = async (
  tagId: number,
  params?: {
    page?: number
    limit?: number
  }
): Promise<TagCustomersResponse> => {
  const response = await callApiContract(tagContracts.getCustomers, { tagId, params })
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
  const response = await callApiContract(tagContracts.getConversations, { tagId, params })
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch tag conversations')
  }
  return {
    success: response.success,
    data: response.data,
    message: response.message || 'Tag conversations retrieved successfully'
  }
}
