import type { DelegationPolicyPort } from '../../domain/repositories/DelegationPolicyPort'

/** PutDelegationPolicy: one operation of DelegationPolicyPort, called by the presentation layer's feature hooks. */
export class PutDelegationPolicyUseCase {
  private readonly repository: Pick<DelegationPolicyPort, 'put'>

  constructor(repository: Pick<DelegationPolicyPort, 'put'>) {
    this.repository = repository
  }

  execute(...args: Parameters<DelegationPolicyPort['put']>): ReturnType<DelegationPolicyPort['put']> {
    return this.repository.put(...args)
  }
}
