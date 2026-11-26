import type { OrgMembershipPort } from '../../domain/repositories/OrgMembershipPort'

/** SetRoles: one operation of OrgMembershipPort, called by the presentation layer's feature hooks. */
export class SetRolesUseCase {
  private readonly repository: Pick<OrgMembershipPort, 'setRoles'>

  constructor(repository: Pick<OrgMembershipPort, 'setRoles'>) {
    this.repository = repository
  }

  execute(...args: Parameters<OrgMembershipPort['setRoles']>): ReturnType<OrgMembershipPort['setRoles']> {
    return this.repository.setRoles(...args)
  }
}
