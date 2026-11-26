import type { OrgMembershipPort } from '../../domain/repositories/OrgMembershipPort'

/** GetTenant: one operation of OrgMembershipPort, called by the presentation layer's feature hooks. */
export class GetTenantUseCase {
  private readonly repository: Pick<OrgMembershipPort, 'getTenant'>

  constructor(repository: Pick<OrgMembershipPort, 'getTenant'>) {
    this.repository = repository
  }

  execute(...args: Parameters<OrgMembershipPort['getTenant']>): ReturnType<OrgMembershipPort['getTenant']> {
    return this.repository.getTenant(...args)
  }
}
