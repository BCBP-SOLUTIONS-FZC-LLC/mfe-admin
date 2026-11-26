import type { OrgMembershipPort } from '../../domain/repositories/OrgMembershipPort'

/** ListMembers: one operation of OrgMembershipPort, called by the presentation layer's feature hooks. */
export class ListMembersUseCase {
  private readonly repository: Pick<OrgMembershipPort, 'listMembers'>

  constructor(repository: Pick<OrgMembershipPort, 'listMembers'>) {
    this.repository = repository
  }

  execute(...args: Parameters<OrgMembershipPort['listMembers']>): ReturnType<OrgMembershipPort['listMembers']> {
    return this.repository.listMembers(...args)
  }
}
