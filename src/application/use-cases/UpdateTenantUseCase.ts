import type { OrgMembershipPort } from '../../domain/repositories/OrgMembershipPort'

/** UpdateTenant: one operation of OrgMembershipPort, called by the presentation layer's feature hooks. */
export class UpdateTenantUseCase {
  private readonly repository: Pick<OrgMembershipPort, 'updateTenant'>

  constructor(repository: Pick<OrgMembershipPort, 'updateTenant'>) {
    this.repository = repository
  }

  execute(...args: Parameters<OrgMembershipPort['updateTenant']>): ReturnType<OrgMembershipPort['updateTenant']> {
    return this.repository.updateTenant(...args)
  }
}
