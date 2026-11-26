import type { DelegationPolicyPort } from '../../domain/repositories/DelegationPolicyPort'

/** GetDelegationPolicy: one operation of DelegationPolicyPort, called by the presentation layer's feature hooks. */
export class GetDelegationPolicyUseCase {
  private readonly repository: Pick<DelegationPolicyPort, 'get'>

  constructor(repository: Pick<DelegationPolicyPort, 'get'>) {
    this.repository = repository
  }

  execute(...args: Parameters<DelegationPolicyPort['get']>): ReturnType<DelegationPolicyPort['get']> {
    return this.repository.get(...args)
  }
}
