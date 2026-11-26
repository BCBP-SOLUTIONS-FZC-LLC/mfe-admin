import type { AuditEntry, AuditExport, AuditExportAccepted, AuditSearchResult } from '../entities/audit'
import type { AuditFilter } from '../value-objects/AuditFilter'
import type { Cursor } from '../value-objects/Cursor'

/** Audit Log (IAM), AL-1…AL-4. */
export interface AuditPort {
  /** AL-1: results, or a `202` export job for a large search. The service clamps `from` to the plan's window. */
  search(filter: AuditFilter, page: { readonly limit: number; readonly cursor?: Cursor }, signal?: AbortSignal): Promise<AuditSearchResult>
  /** AL-2 */
  getEntry(id: string, signal?: AbortSignal): Promise<AuditEntry>
  /** AL-3: start an export of everything the filter matches. */
  requestExport(filter: AuditFilter, signal?: AbortSignal): Promise<AuditExportAccepted>
  /** AL-4: poll; a ready export's download URL is fresh on each poll. */
  getExport(exportId: string, signal?: AbortSignal): Promise<AuditExport>
}
