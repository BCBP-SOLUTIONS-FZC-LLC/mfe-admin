// Audit entries, pages and exports for the screen tests.
import type { AuditEntry, AuditExport } from '../../src/domain/entities/audit'
import { parseCursor } from '../../src/domain/value-objects/Cursor'

export const entry = (id: string, o: Partial<AuditEntry> = {}): AuditEntry => ({
  id,
  occurredAt: '2026-11-25T10:00:00Z',
  actor: { type: 'user', display: 'Ada Lovelace', id: 'u-ada' },
  action: 'member.suspended',
  entryType: 'membership.suspended',
  target: { type: 'member', id: 'u-bob' },
  sourceService: 'iam-org-membership',
  retentionTier: 'security_3y',
  ipAddress: '203.0.113.7',
  traceId: 'trace-abc',
  metadata: { reason: 'left the company', count: 2 },
  ...o,
})

export const page = (entries: AuditEntry[], o: { next?: string; clamped?: string } = {}) => ({
  kind: 'page' as const,
  page: { entries, ...(o.next ? { nextCursor: parseCursor(o.next)! } : {}), windowClamped: o.clamped !== undefined, ...(o.clamped ? { effectiveFrom: o.clamped } : {}) },
})

export const exportJob = (o: Partial<AuditExport> = {}): AuditExport => ({ exportId: 'ex-1', status: 'ready', createdAt: '2026-11-25T10:00:00Z', ...o })
