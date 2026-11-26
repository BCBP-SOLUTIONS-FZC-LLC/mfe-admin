import type { OrgMembershipPort } from '../../domain/repositories/OrgMembershipPort'

/** RenameRoleLabel: one operation of OrgMembershipPort, called by the presentation layer's feature hooks. */
export class RenameRoleLabelUseCase {
  private readonly repository: Pick<OrgMembershipPort, 'renameRoleLabel'>

  constructor(repository: Pick<OrgMembershipPort, 'renameRoleLabel'>) {
    this.repository = repository
  }

  execute(...args: Parameters<OrgMembershipPort['renameRoleLabel']>): ReturnType<OrgMembershipPort['renameRoleLabel']> {
    return this.repository.renameRoleLabel(...args)
  }
}
