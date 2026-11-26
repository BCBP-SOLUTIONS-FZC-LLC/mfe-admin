// Delegation, the tenant policy only (DLG-6, DLG-7). No tenant ID in the path: the gateway injects it.
import type { DelegationPolicyPort } from '../../domain/repositories/DelegationPolicyPort'
import { toDelegationPolicy, toDelegationPolicyBody } from './mappers'
import { withSignal, type ApiScope } from './scope'

export function createDelegationPolicyAdapter(scope: ApiScope): DelegationPolicyPort {
  const { client } = scope
  const sig = withSignal
  return {
    async get(signal) {
      const res = await client.get('/v1/delegations/settings', sig(signal))
      return toDelegationPolicy(res.data)
    },
    async put(policy, signal) {
      const res = await client.put('/v1/delegations/settings', { body: toDelegationPolicyBody(policy), ...sig(signal) })
      return toDelegationPolicy(res.data)
    },
  }
}
