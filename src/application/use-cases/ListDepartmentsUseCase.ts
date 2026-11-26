import type { OrgMembershipPort } from '../../domain/repositories/OrgMembershipPort'

/** ListDepartments: one operation of OrgMembershipPort, called by the presentation layer's feature hooks. */
export class ListDepartmentsUseCase {
  private readonly repository: Pick<OrgMembershipPort, 'listDepartments'>

  constructor(repository: Pick<OrgMembershipPort, 'listDepartments'>) {
    this.repository = repository
  }

  execute(...args: Parameters<OrgMembershipPort['listDepartments']>): ReturnType<OrgMembershipPort['listDepartments']> {
    return this.repository.listDepartments(...args)
  }
}
