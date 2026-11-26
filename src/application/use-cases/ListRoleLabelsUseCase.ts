import type { OrgMembershipPort } from '../../domain/repositories/OrgMembershipPort'

/** ListRoleLabels: one operation of OrgMembershipPort, called by the presentation layer's feature hooks. */
export class ListRoleLabelsUseCase {
  private readonly repository: Pick<OrgMembershipPort, 'listRoleLabels'>

  constructor(repository: Pick<OrgMembershipPort, 'listRoleLabels'>) {
    this.repository = repository
  }

  execute(...args: Parameters<OrgMembershipPort['listRoleLabels']>): ReturnType<OrgMembershipPort['listRoleLabels']> {
    return this.repository.listRoleLabels(...args)
  }
}
