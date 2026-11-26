import type { OrgMembershipPort } from '../../domain/repositories/OrgMembershipPort'

/** ResolveRemoval: one operation of OrgMembershipPort, called by the presentation layer's feature hooks. */
export class ResolveRemovalUseCase {
  private readonly repository: Pick<OrgMembershipPort, 'resolveRemoval'>

  constructor(repository: Pick<OrgMembershipPort, 'resolveRemoval'>) {
    this.repository = repository
  }

  execute(...args: Parameters<OrgMembershipPort['resolveRemoval']>): ReturnType<OrgMembershipPort['resolveRemoval']> {
    return this.repository.resolveRemoval(...args)
  }
}
