import type { AuditPort } from '../../domain/repositories/AuditPort'

/** GetAuditExport: one operation of AuditPort, called by the presentation layer's feature hooks. */
export class GetAuditExportUseCase {
  private readonly repository: Pick<AuditPort, 'getExport'>

  constructor(repository: Pick<AuditPort, 'getExport'>) {
    this.repository = repository
  }

  execute(...args: Parameters<AuditPort['getExport']>): ReturnType<AuditPort['getExport']> {
    return this.repository.getExport(...args)
  }
}
