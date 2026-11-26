import type { OrgMembershipPort } from '../../domain/repositories/OrgMembershipPort'

/** GetMember: one operation of OrgMembershipPort, called by the presentation layer's feature hooks. */
export class GetMemberUseCase {
  private readonly repository: Pick<OrgMembershipPort, 'getMember'>

  constructor(repository: Pick<OrgMembershipPort, 'getMember'>) {
    this.repository = repository
  }

  execute(...args: Parameters<OrgMembershipPort['getMember']>): ReturnType<OrgMembershipPort['getMember']> {
    return this.repository.getMember(...args)
  }
}
