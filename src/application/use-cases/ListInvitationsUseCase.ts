import type { OrgMembershipPort } from '../../domain/repositories/OrgMembershipPort'

/** ListInvitations: one operation of OrgMembershipPort, called by the presentation layer's feature hooks. */
export class ListInvitationsUseCase {
  private readonly repository: Pick<OrgMembershipPort, 'listInvitations'>

  constructor(repository: Pick<OrgMembershipPort, 'listInvitations'>) {
    this.repository = repository
  }

  execute(...args: Parameters<OrgMembershipPort['listInvitations']>): ReturnType<OrgMembershipPort['listInvitations']> {
    return this.repository.listInvitations(...args)
  }
}
