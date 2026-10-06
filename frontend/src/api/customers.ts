import { apiClient } from './base'

export interface UpdatedCustomer {
  id: number
  displayName: string // 此回應中為平台原始名稱
  customName: string | null
}

/**
 * 設定客戶全域暱稱。null 或空字串 = 清除暱稱。
 */
export const updateCustomerName = async (
  customerId: number,
  customName: string | null
): Promise<UpdatedCustomer> => {
  const response = await apiClient.patch<{ customer: UpdatedCustomer }>(
    `/customers/${customerId}`,
    { customName }
  )
  if (!response.success || !response.data) {
    throw new Error(response.error || '更新客戶暱稱失敗')
  }
  return response.data.customer
}
