import type { OrgMembershipPort } from '../../domain/repositories/OrgMembershipPort'

/** ListDepartmentMembers: one operation of OrgMembershipPort, called by the presentation layer's feature hooks. */
export class ListDepartmentMembersUseCase {
  private readonly repository: Pick<OrgMembershipPort, 'listDepartmentMembers'>

  constructor(repository: Pick<OrgMembershipPort, 'listDepartmentMembers'>) {
    this.repository = repository
  }

  execute(...args: Parameters<OrgMembershipPort['listDepartmentMembers']>): ReturnType<OrgMembershipPort['listDepartmentMembers']> {
    return this.repository.listDepartmentMembers(...args)
  }
}
