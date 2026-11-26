import type { OrgMembershipPort } from '../../domain/repositories/OrgMembershipPort'

/** SetDepartmentActive: one operation of OrgMembershipPort, called by the presentation layer's feature hooks. */
export class SetDepartmentActiveUseCase {
  private readonly repository: Pick<OrgMembershipPort, 'setDepartmentActive'>

  constructor(repository: Pick<OrgMembershipPort, 'setDepartmentActive'>) {
    this.repository = repository
  }

  execute(...args: Parameters<OrgMembershipPort['setDepartmentActive']>): ReturnType<OrgMembershipPort['setDepartmentActive']> {
    return this.repository.setDepartmentActive(...args)
  }
}
