import type { AuditPort } from '../../domain/repositories/AuditPort'

/** SearchAudit: one operation of AuditPort, called by the presentation layer's feature hooks. */
export class SearchAuditUseCase {
  private readonly repository: Pick<AuditPort, 'search'>

  constructor(repository: Pick<AuditPort, 'search'>) {
    this.repository = repository
  }

  execute(...args: Parameters<AuditPort['search']>): ReturnType<AuditPort['search']> {
    return this.repository.search(...args)
  }
}
