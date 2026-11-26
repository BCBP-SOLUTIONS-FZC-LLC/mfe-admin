import type { OrgMembershipPort } from '../../domain/repositories/OrgMembershipPort'

/** RemoveMember: one operation of OrgMembershipPort, called by the presentation layer's feature hooks. */
export class RemoveMemberUseCase {
  private readonly repository: Pick<OrgMembershipPort, 'removeMember'>

  constructor(repository: Pick<OrgMembershipPort, 'removeMember'>) {
    this.repository = repository
  }

  execute(...args: Parameters<OrgMembershipPort['removeMember']>): ReturnType<OrgMembershipPort['removeMember']> {
    return this.repository.removeMember(...args)
  }
}
