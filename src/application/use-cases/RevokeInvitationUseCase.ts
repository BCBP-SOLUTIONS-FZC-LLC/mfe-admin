import type { OrgMembershipPort } from '../../domain/repositories/OrgMembershipPort'

/** RevokeInvitation: one operation of OrgMembershipPort, called by the presentation layer's feature hooks. */
export class RevokeInvitationUseCase {
  private readonly repository: Pick<OrgMembershipPort, 'revokeInvitation'>

  constructor(repository: Pick<OrgMembershipPort, 'revokeInvitation'>) {
    this.repository = repository
  }

  execute(...args: Parameters<OrgMembershipPort['revokeInvitation']>): ReturnType<OrgMembershipPort['revokeInvitation']> {
    return this.repository.revokeInvitation(...args)
  }
}
