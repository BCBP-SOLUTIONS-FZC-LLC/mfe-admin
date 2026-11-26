import type { OrgMembershipPort } from '../../domain/repositories/OrgMembershipPort'

/** GetSeatUsage: one operation of OrgMembershipPort, called by the presentation layer's feature hooks. */
export class GetSeatUsageUseCase {
  private readonly repository: Pick<OrgMembershipPort, 'getSeatUsage'>

  constructor(repository: Pick<OrgMembershipPort, 'getSeatUsage'>) {
    this.repository = repository
  }

  execute(...args: Parameters<OrgMembershipPort['getSeatUsage']>): ReturnType<OrgMembershipPort['getSeatUsage']> {
    return this.repository.getSeatUsage(...args)
  }
}
