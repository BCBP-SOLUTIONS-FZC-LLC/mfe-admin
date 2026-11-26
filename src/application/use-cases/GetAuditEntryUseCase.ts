import type { AuditPort } from '../../domain/repositories/AuditPort'

/** GetAuditEntry: one operation of AuditPort, called by the presentation layer's feature hooks. */
export class GetAuditEntryUseCase {
  private readonly repository: Pick<AuditPort, 'getEntry'>

  constructor(repository: Pick<AuditPort, 'getEntry'>) {
    this.repository = repository
  }

  execute(...args: Parameters<AuditPort['getEntry']>): ReturnType<AuditPort['getEntry']> {
    return this.repository.getEntry(...args)
  }
}
