import { apiClient } from './base'
import type { RequestOptions } from './base'
import type {
  ApiContractEndpoint,
  ContractBody,
  ContractParams,
  ContractResponse
} from '@shared/api-contracts'

type ApiContractArgs<TContract extends ApiContractEndpoint<never, unknown, unknown, unknown>> =
  ContractBody<TContract> extends void
    ? [params: ContractParams<TContract>, options?: RequestOptions]
    : [params: ContractParams<TContract>, body: ContractBody<TContract>, options?: RequestOptions]

export function callApiContract<TContract extends ApiContractEndpoint<never, unknown, unknown, unknown>>(
  contract: TContract,
  ...args: ApiContractArgs<TContract>
): Promise<ContractResponse<TContract>> {
  const [params, bodyOrOptions, maybeOptions] = args as [
    ContractParams<TContract>,
    ContractBody<TContract> | RequestOptions | undefined,
    RequestOptions | undefined
  ]
  const hasBody = args.length >= 3 || contract.hasRequestBody || (
    args.length === 2 && (contract.method === 'POST' || contract.method === 'PUT')
  )
  const body = hasBody ? bodyOrOptions as ContractBody<TContract> : undefined
  const options = hasBody ? maybeOptions : bodyOrOptions as RequestOptions | undefined
  const buildPath = contract.path as (_params: ContractParams<TContract>) => string
  const endpoint = buildPath(params)

  if (contract.transport === 'upload') {
    return apiClient.uploadFile(endpoint, body as globalThis.FormData) as Promise<ContractResponse<TContract>>
  }

  if (contract.transport === 'download') {
    return apiClient.downloadFile(endpoint) as Promise<ContractResponse<TContract>>
  }

  switch (contract.method) {
    case 'GET':
      return (
        options ? apiClient.get(endpoint, options) : apiClient.get(endpoint)
      ) as Promise<ContractResponse<TContract>>
    case 'POST':
      if (!hasBody) {
        return (
          options ? apiClient.post(endpoint, undefined, options) : apiClient.post(endpoint)
        ) as Promise<ContractResponse<TContract>>
      }
      return (
        options ? apiClient.post(endpoint, body, options) : apiClient.post(endpoint, body)
      ) as Promise<ContractResponse<TContract>>
    case 'PUT':
      if (!hasBody) {
        return (
          options ? apiClient.put(endpoint, undefined, options) : apiClient.put(endpoint)
        ) as Promise<ContractResponse<TContract>>
      }
      return (
        options ? apiClient.put(endpoint, body, options) : apiClient.put(endpoint, body)
      ) as Promise<ContractResponse<TContract>>
    case 'DELETE':
      if (args.length > 1 && bodyOrOptions !== undefined) {
        return (
          options
            ? apiClient.request('DELETE', endpoint, body, options)
            : apiClient.request('DELETE', endpoint, body)
        ) as Promise<ContractResponse<TContract>>
      }
      return (
        options ? apiClient.delete(endpoint, options) : apiClient.delete(endpoint)
      ) as Promise<ContractResponse<TContract>>
  }
}
