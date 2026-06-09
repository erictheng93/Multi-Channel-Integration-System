import { modernApiClient } from './modern-client'
import type {
  ApiContractEndpoint,
  ContractBody,
  ContractParams,
  ContractResponse
} from '@shared/api-contracts'

type ModernApiContractArgs<TContract extends ApiContractEndpoint<never, unknown, unknown, unknown>> =
  ContractBody<TContract> extends void
    ? [params: ContractParams<TContract>]
    : [params: ContractParams<TContract>, body: ContractBody<TContract>]

export function callModernApiContract<
  TContract extends ApiContractEndpoint<never, unknown, unknown, unknown>
>(
  contract: TContract,
  ...args: ModernApiContractArgs<TContract>
): Promise<ContractResponse<TContract>> {
  const [params, body] = args as [ContractParams<TContract>, ContractBody<TContract>?]
  const buildPath = contract.path as (_params: ContractParams<TContract>) => string
  const endpoint = buildPath(params)

  switch (contract.method) {
    case 'GET':
      return modernApiClient.get(endpoint) as Promise<ContractResponse<TContract>>
    case 'POST':
      return modernApiClient.post(endpoint, body) as Promise<ContractResponse<TContract>>
    case 'PUT':
      return modernApiClient.put(endpoint, body) as Promise<ContractResponse<TContract>>
    case 'DELETE':
      return modernApiClient.delete(endpoint, body) as Promise<ContractResponse<TContract>>
  }
}
