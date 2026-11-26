import type { OrgMembershipPort } from '../../domain/repositories/OrgMembershipPort'

/** SetMemberStatus: one operation of OrgMembershipPort, called by the presentation layer's feature hooks. */
export class SetMemberStatusUseCase {
  private readonly repository: Pick<OrgMembershipPort, 'setMemberStatus'>

  constructor(repository: Pick<OrgMembershipPort, 'setMemberStatus'>) {
    this.repository = repository
  }

  execute(...args: Parameters<OrgMembershipPort['setMemberStatus']>): ReturnType<OrgMembershipPort['setMemberStatus']> {
    return this.repository.setMemberStatus(...args)
  }
}
