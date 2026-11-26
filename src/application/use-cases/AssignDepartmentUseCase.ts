import type { OrgMembershipPort } from '../../domain/repositories/OrgMembershipPort'

/** AssignDepartment: one operation of OrgMembershipPort, called by the presentation layer's feature hooks. */
export class AssignDepartmentUseCase {
  private readonly repository: Pick<OrgMembershipPort, 'assignDepartment'>

  constructor(repository: Pick<OrgMembershipPort, 'assignDepartment'>) {
    this.repository = repository
  }

  execute(...args: Parameters<OrgMembershipPort['assignDepartment']>): ReturnType<OrgMembershipPort['assignDepartment']> {
    return this.repository.assignDepartment(...args)
  }
}
