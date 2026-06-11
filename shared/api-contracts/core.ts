import type { ApiResponse } from '../types/api'

export type ApiHttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'
export type ApiTransport = 'json' | 'upload' | 'download'

export interface ApiContractEndpoint<
  TParams,
  TBody,
  TData,
  TResponse = ApiResponse<TData>
> {
  method: ApiHttpMethod
  path: (_params: TParams) => string
  transport?: ApiTransport
  hasRequestBody?: boolean
  body?: TBody
  data?: TData
  response?: TResponse
}

export type ContractParams<TContract> =
  TContract extends ApiContractEndpoint<infer TParams, any, any, any> ? TParams : never

export type ContractBody<TContract> =
  TContract extends ApiContractEndpoint<any, infer TBody, any, any> ? TBody : never

export type ContractData<TContract> =
  TContract extends ApiContractEndpoint<any, any, infer TData, any> ? TData : never

export type ContractResponse<TContract> =
  TContract extends ApiContractEndpoint<any, any, any, infer TResponse> ? TResponse : never

export function defineApiContract<TParams, TBody, TData, TResponse = ApiResponse<TData>>(
  contract: ApiContractEndpoint<TParams, TBody, TData, TResponse>
): ApiContractEndpoint<TParams, TBody, TData, TResponse> {
  return contract
}
