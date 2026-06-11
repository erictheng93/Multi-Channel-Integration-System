import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { ApiContractEndpoint, ContractResponse } from '@shared/api-contracts'

type AnyApiContract = ApiContractEndpoint<never, unknown, unknown, unknown>
type JsonContext = Pick<Context, 'json'>

export function contractJson<
  TContract extends AnyApiContract,
  TStatus extends ContentfulStatusCode = ContentfulStatusCode
>(
  c: JsonContext,
  _contract: TContract,
  body: ContractResponse<TContract>,
  status?: TStatus
) {
  return status === undefined ? c.json(body) : c.json(body, status)
}
