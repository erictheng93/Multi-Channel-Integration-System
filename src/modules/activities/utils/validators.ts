// Activities Module - Validation Utilities
// 活動模組 - 驗證工具

import { ACTIVITY_ACTIONS, ActivityAction } from '@modules/activities/constants/actions'
import { RESOURCE_TYPES, ResourceType } from '@modules/activities/constants/resources'
import { CreateActivityRequest, ActivityQueryParams } from '@modules/activities/types/interfaces'

export interface ValidationError {
  field: string
  message: string
  value?: any
}

export class ActivityValidator {
  static validateCreateRequest(request: CreateActivityRequest): ValidationError[] {
    const errors: ValidationError[] = []

    // 檢查必填欄位
    if (!request.userId?.trim()) {
      errors.push({ field: 'userId', message: 'User ID is required', value: request.userId })
    }

    if (!request.userName?.trim()) {
      errors.push({ field: 'userName', message: 'User name is required', value: request.userName })
    }

    if (!request.userRole?.trim()) {
      errors.push({ field: 'userRole', message: 'User role is required', value: request.userRole })
    }

    if (!request.action?.trim()) {
      errors.push({ field: 'action', message: 'Action is required', value: request.action })
    }

    if (!request.resourceType?.trim()) {
      errors.push({ field: 'resourceType', message: 'Resource type is required', value: request.resourceType })
    }

    // 檢查動作是否有效
    const validActions = Object.values(ACTIVITY_ACTIONS)
    if (request.action && !validActions.includes(request.action as ActivityAction)) {
      errors.push({
        field: 'action',
        message: `Invalid action. Must be one of: ${validActions.join(', ')}`,
        value: request.action
      })
    }

    // 檢查資源類型是否有效
    const validResourceTypes = Object.values(RESOURCE_TYPES)
    if (request.resourceType && !validResourceTypes.includes(request.resourceType as ResourceType)) {
      errors.push({
        field: 'resourceType',
        message: `Invalid resource type. Must be one of: ${validResourceTypes.join(', ')}`,
        value: request.resourceType
      })
    }

    // SECURITY: Check user role format (2-tier system)
    const validRoles = ['admin', 'agent']
    if (request.userRole && !validRoles.includes(request.userRole)) {
      errors.push({
        field: 'userRole',
        message: `Invalid user role. Must be one of: ${validRoles.join(', ')}`,
        value: request.userRole
      })
    }

    // 檢查 details 是否為有效 JSON 物件
    if (request.details && typeof request.details !== 'object') {
      errors.push({
        field: 'details',
        message: 'Details must be a valid object',
        value: request.details
      })
    }

    return errors
  }

  static validateQueryParams(params: ActivityQueryParams): ValidationError[] {
    const errors: ValidationError[] = []

    // 檢查頁碼
    if (params.page !== undefined) {
      const page = Number(params.page)
      if (isNaN(page) || page < 1) {
        errors.push({
          field: 'page',
          message: 'Page must be a positive integer',
          value: params.page
        })
      }
    }

    // 檢查頁面大小
    if (params.pageSize !== undefined) {
      const pageSize = Number(params.pageSize)
      if (isNaN(pageSize) || pageSize < 1 || pageSize > 1000) {
        errors.push({
          field: 'pageSize',
          message: 'Page size must be between 1 and 1000',
          value: params.pageSize
        })
      }
    }

    // 檢查日期格式
    if (params.startDate && !this.isValidISODate(params.startDate)) {
      errors.push({
        field: 'startDate',
        message: 'Start date must be a valid ISO date string',
        value: params.startDate
      })
    }

    if (params.endDate && !this.isValidISODate(params.endDate)) {
      errors.push({
        field: 'endDate',
        message: 'End date must be a valid ISO date string',
        value: params.endDate
      })
    }

    // 檢查日期範圍
    if (params.startDate && params.endDate) {
      const startDate = new Date(params.startDate)
      const endDate = new Date(params.endDate)
      if (startDate > endDate) {
        errors.push({
          field: 'dateRange',
          message: 'Start date must be before end date',
          value: { startDate: params.startDate, endDate: params.endDate }
        })
      }
    }

    return errors
  }

  static validateCleanupParams(daysToKeep: number): ValidationError[] {
    const errors: ValidationError[] = []

    if (isNaN(daysToKeep) || daysToKeep < 1) {
      errors.push({
        field: 'daysToKeep',
        message: 'Days to keep must be a positive integer',
        value: daysToKeep
      })
    }

    if (daysToKeep < 30) {
      errors.push({
        field: 'daysToKeep',
        message: 'Must keep at least 30 days of activity logs',
        value: daysToKeep
      })
    }

    if (daysToKeep > 3650) { // 10 years
      errors.push({
        field: 'daysToKeep',
        message: 'Cannot keep more than 10 years of activity logs',
        value: daysToKeep
      })
    }

    return errors
  }

  private static isValidISODate(dateString: string): boolean {
    const date = new Date(dateString)
    return date instanceof Date && !isNaN(date.getTime()) && dateString.includes('T')
  }
}