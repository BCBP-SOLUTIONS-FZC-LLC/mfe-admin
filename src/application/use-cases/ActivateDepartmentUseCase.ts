import type { OrgMembershipPort } from '../../domain/repositories/OrgMembershipPort'

/** ActivateDepartment: one operation of OrgMembershipPort, called by the presentation layer's feature hooks. */
export class ActivateDepartmentUseCase {
  private readonly repository: Pick<OrgMembershipPort, 'activateDepartment'>

  constructor(repository: Pick<OrgMembershipPort, 'activateDepartment'>) {
    this.repository = repository
  }

  execute(...args: Parameters<OrgMembershipPort['activateDepartment']>): ReturnType<OrgMembershipPort['activateDepartment']> {
    return this.repository.activateDepartment(...args)
  }
}
