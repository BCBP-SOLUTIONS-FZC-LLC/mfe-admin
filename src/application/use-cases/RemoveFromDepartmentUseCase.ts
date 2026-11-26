import type { OrgMembershipPort } from '../../domain/repositories/OrgMembershipPort'

/** RemoveFromDepartment: one operation of OrgMembershipPort, called by the presentation layer's feature hooks. */
export class RemoveFromDepartmentUseCase {
  private readonly repository: Pick<OrgMembershipPort, 'removeFromDepartment'>

  constructor(repository: Pick<OrgMembershipPort, 'removeFromDepartment'>) {
    this.repository = repository
  }

  execute(...args: Parameters<OrgMembershipPort['removeFromDepartment']>): ReturnType<OrgMembershipPort['removeFromDepartment']> {
    return this.repository.removeFromDepartment(...args)
  }
}
