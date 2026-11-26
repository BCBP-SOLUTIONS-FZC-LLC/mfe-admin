import type { ActorType, RetentionTier } from '../value-objects/AuditFilter'
import type { Cursor } from '../value-objects/Cursor'

export interface AuditActor {
  readonly type: ActorType
  /** The display name from the entry. A service account shows as "Automation", `iam_system` as "System". */
  readonly display?: string
  readonly id?: string
}

export interface AuditEntry {
  readonly id: string
  /** UTC instant; rendered in the profile timezone (IAM-UX-14). */
  readonly occurredAt: string
  readonly actor: AuditActor
  readonly action: string
  /** The taxonomy entry type (`auth.login`, `membership.added`, …). */
  readonly entryType: string
  readonly target?: { readonly type?: string; readonly id?: string }
  readonly sourceService: string
  readonly retentionTier?: RetentionTier
  readonly ipAddress?: string
  readonly traceId?: string
  readonly metadata: Readonly<Record<string, unknown>>
}

/** One page of search results (AL-1). The service clamps `from` to the plan's window. */
export interface AuditPage {
  readonly entries: readonly AuditEntry[]
  readonly nextCursor?: Cursor
  readonly windowClamped: boolean
  readonly effectiveFrom?: string
}

/** A large search answers `202` with a job instead of results: switch to the export tracker. */
export interface AuditExportAccepted {
  readonly exportId: string
  readonly status: AuditExportStatus
}

export type AuditExportStatus = 'pending' | 'running' | 'ready' | 'failed' | 'expired'

export interface AuditExport {
  readonly exportId: string
  readonly status: AuditExportStatus
  readonly createdAt?: string
  readonly completedAt?: string
  readonly rowCount?: number
  /** Re-issued, short-lived, on every poll while `ready`. */
  readonly downloadUrl?: string
  readonly downloadUrlExpiresAt?: string
  /** The file stays retrievable for 7 days. */
  readonly expiresAt?: string
  /** Why it failed. */
  readonly error?: string
}

/** Search outcome: results, or (a large search) an export job. */
export type AuditSearchResult = { readonly kind: 'page'; readonly page: AuditPage } | { readonly kind: 'export'; readonly job: AuditExportAccepted }
