import type { OrgMembershipPort } from '../../domain/repositories/OrgMembershipPort'

/** Invite: one operation of OrgMembershipPort, called by the presentation layer's feature hooks. */
export class InviteUseCase {
  private readonly repository: Pick<OrgMembershipPort, 'invite'>

  constructor(repository: Pick<OrgMembershipPort, 'invite'>) {
    this.repository = repository
  }

  execute(...args: Parameters<OrgMembershipPort['invite']>): ReturnType<OrgMembershipPort['invite']> {
    return this.repository.invite(...args)
  }
}
