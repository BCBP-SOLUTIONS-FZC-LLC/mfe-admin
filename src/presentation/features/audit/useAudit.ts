// E7's data and writes: the filtered, keyset-paged search (AL-1), one entry in full (AL-2), starting an
// export (AL-3) and following one (AL-4). The search runs only for a query the rules accept; the
// export list is kept by ID in the job store, because the service has no "list my exports" route.
import { useCallback, useEffect, useState } from 'react'
import type { AuditExport, AuditSearchResult } from '../../../domain/entities/audit'
import { auditFilterToEntries, type AuditFilter } from '../../../domain/value-objects/AuditFilter'
import { parseCursor } from '../../../domain/value-objects/Cursor'
import { AUDIT_PAGE, planAuditQuery } from '../../../domain/rules/admin-rules'
import { useAdminServices, useAdminUseCases } from '../services'
import { useTrackedInfiniteQuery, useTrackedMutation, useTrackedQuery } from '../tracked'
import { useAdminKeys } from '../workspace'

/** How often a pending or running export is asked about. */
export const EXPORT_POLL_MS = 5_000

export function useAuditSearch(filter: AuditFilter) {
  const useCases = useAdminUseCases()
  const { exportJobs } = useAdminServices()
  const { keys } = useAdminKeys()
  const plan = planAuditQuery(filter)
  const query = useTrackedInfiniteQuery<AuditSearchResult>({
    resource: 'audit',
    queryKey: keys.audit(Object.fromEntries([...auditFilterToEntries(filter), ['limit', String(AUDIT_PAGE.default)]])),
    enabled: plan.ok,
    queryFn: (cursor, signal) => useCases.searchAudit.execute(filter, { limit: AUDIT_PAGE.default, ...(cursor ? { cursor: parseCursor(cursor)! } : {}) }, signal),
    nextCursor: (result) => (result.kind === 'page' ? result.page.nextCursor : undefined),
  })
  // A large search answers a job instead of rows (202): follow it with the exports.
  const job = query.data?.pages.find((p) => p.kind === 'export')
  const jobId = job?.kind === 'export' ? job.job.exportId : undefined
  useEffect(() => {
    if (jobId) exportJobs.add(jobId)
  }, [jobId, exportJobs])
  return { query, plan, jobId }
}

/** AL-2: one entry in full. */
export function useAuditEntry(id: string) {
  const useCases = useAdminUseCases()
  const { keys } = useAdminKeys()
  return useTrackedQuery({ resource: 'audit', queryKey: keys.auditEntry(id), queryFn: (signal) => useCases.getAuditEntry.execute(id, signal), staleTime: 60_000 })
}

/** AL-3: starts an export of everything the filter matches, and tracks it. */
export function useRequestExport() {
  const useCases = useAdminUseCases()
  const { exportJobs } = useAdminServices()
  return useTrackedMutation({
    action: 'request_audit_export',
    mutationFn: async (filter: AuditFilter) => {
      const accepted = await useCases.requestAuditExport.execute(filter)
      exportJobs.add(accepted.exportId)
      return accepted
    },
  })
}

/** AL-4: an export's state, asked again every few seconds while it is waiting or running. */
export function useExportJob(exportId: string) {
  const useCases = useAdminUseCases()
  const { keys } = useAdminKeys()
  return useTrackedQuery<AuditExport>({
    resource: 'audit_exports',
    queryKey: keys.auditExport(exportId),
    queryFn: (signal) => useCases.getAuditExport.execute(exportId, signal),
    refetchInterval: (data) => (data && (data.status === 'pending' || data.status === 'running') ? EXPORT_POLL_MS : false),
  })
}

/** The tracked export IDs, newest first, with a way to drop one. */
export function useExportJobs() {
  const { exportJobs } = useAdminServices()
  const [ids, setIds] = useState<readonly string[]>(() => exportJobs.list())
  const remove = useCallback(
    (id: string) => {
      exportJobs.remove(id)
      setIds(exportJobs.list())
    },
    [exportJobs],
  )
  return { ids, remove }
}
