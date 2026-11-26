import type { AuditPort } from '../../domain/repositories/AuditPort'

/** RequestAuditExport: one operation of AuditPort, called by the presentation layer's feature hooks. */
export class RequestAuditExportUseCase {
  private readonly repository: Pick<AuditPort, 'requestExport'>

  constructor(repository: Pick<AuditPort, 'requestExport'>) {
    this.repository = repository
  }

  execute(...args: Parameters<AuditPort['requestExport']>): ReturnType<AuditPort['requestExport']> {
    return this.repository.requestExport(...args)
  }
}
