import type { OrgMembershipPort } from '../../domain/repositories/OrgMembershipPort'

/** ResetMfa: one operation of OrgMembershipPort, called by the presentation layer's feature hooks. */
export class ResetMfaUseCase {
  private readonly repository: Pick<OrgMembershipPort, 'resetMfa'>

  constructor(repository: Pick<OrgMembershipPort, 'resetMfa'>) {
    this.repository = repository
  }

  execute(...args: Parameters<OrgMembershipPort['resetMfa']>): ReturnType<OrgMembershipPort['resetMfa']> {
    return this.repository.resetMfa(...args)
  }
}
