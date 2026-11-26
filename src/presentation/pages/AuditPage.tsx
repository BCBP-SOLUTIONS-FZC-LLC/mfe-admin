// E7 Audit log: search by time, entry type, actor, target, source and retention, with the filter in
// the URL; results by keyset cursor (100 a page); the plan's audit window when the service clamps the
// start; a large search that becomes an export job; and "Export these results". LLD §7.10.
import { formatDate } from '@bcbp-solutions-fzc-llc/frontend-sdk/i18n'
import { useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { AuditEntry } from '../../domain/entities/audit'
import type { AuditQueryFailure } from '../../domain/rules/admin-rules'
import { auditFilterFromEntries, auditFilterToEntries, type AuditFilter } from '../../domain/value-objects/AuditFilter'
import { APP_ID } from '../../shared/constants/app'
import LoadFailed from '../components/LoadFailed'
import ProblemDetails from '../components/ProblemDetails'
import { btnOutline, btnPrimary } from '../components/styles'
import { useAdminAccess } from '../features/access/useAdminAccess'
import { useAuditSearch, useRequestExport } from '../features/audit/useAudit'
import { useProblemText } from '../features/useProblemText'
import AuditFilters from './audit/AuditFilters'
import AuditTable, { useActorNames } from './audit/AuditTable'
import EntryDialog from './audit/EntryDialog'
import FilterChips from './audit/FilterChips'

const FAILURE_KEYS = {
  'range-invalid': 'audit.error.range',
  'range-inverted': 'audit.error.inverted',
  'one-entry-type-only': 'audit.error.oneEntryType',
  'page-too-large': 'audit.error.page',
  'page-too-small': 'audit.error.page',
} as const satisfies Record<AuditQueryFailure, string>

export default function AuditPage() {
  const t = useT(APP_ID)
  const problemText = useProblemText()
  const access = useAdminAccess()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const filter = useMemo(() => auditFilterFromEntries([...params.entries()]), [params])
  const { query, plan, jobId } = useAuditSearch(filter)
  const exportJob = useRequestExport()
  const [open, setOpen] = useState<AuditEntry | undefined>()

  const pages = useMemo(() => query.data?.pages ?? [], [query.data])
  const entries = useMemo(() => pages.flatMap((p) => (p.kind === 'page' ? p.page.entries : [])), [pages])
  const clamped = pages.find((p) => p.kind === 'page' && p.page.windowClamped)
  const effectiveFrom = clamped?.kind === 'page' ? clamped.page.effectiveFrom : undefined
  const actorName = useActorNames(entries)

  // An export takes several entry types, so only the range rules apply: a range the page already refuses starts no job.
  const exportRangeInvalid = !plan.ok && (plan.failure === 'range-invalid' || plan.failure === 'range-inverted')
  const apply = (next: AuditFilter) => setParams(new URLSearchParams(auditFilterToEntries(next)))

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-aura-text">{t('audit.title')}</h1>
          <p className="mt-1 text-sm text-aura-muted">{t('audit.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/admin/audit/exports" className={`${btnOutline} no-underline`}>
            {t('audit.exports')}
          </Link>
          <button type="button" className={btnPrimary} disabled={exportJob.isPending || exportRangeInvalid} onClick={() => exportJob.mutate(filter, { onSuccess: () => navigate('/admin/audit/exports', { state: { started: true } }) })}>
            {exportJob.isPending ? t('audit.export.starting') : t('audit.export')}
          </button>
        </div>
      </div>
      {exportJob.isError && (
        <span role="alert" className="flex flex-wrap items-center gap-2 text-sm font-medium text-red-600">
          {problemText(exportJob.error)}
          <ProblemDetails error={exportJob.error} />
        </span>
      )}

      <AuditFilters key={params.toString()} filter={filter} onApply={apply} />
      <FilterChips filter={filter} onChange={apply} />

      {!plan.ok && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {t(FAILURE_KEYS[plan.failure])}
        </p>
      )}
      {effectiveFrom && (
        <p role="status" className="rounded-lg bg-aura-accent-amber-soft px-4 py-2 text-sm text-aura-text">
          {t('audit.clamped', { from: formatDate(effectiveFrom, { dateStyle: 'medium' }) })} {access.canManageAdminRoles && t('audit.clamped.upgrade')}
        </p>
      )}
      {jobId && (
        <p role="status" className="rounded-lg bg-aura-secondary-soft px-4 py-2 text-sm text-aura-text">
          {t('audit.large')}{' '}
          <Link to="/admin/audit/exports" className="font-medium underline">
            {t('audit.large.view')}
          </Link>
        </p>
      )}
      {query.isError && <LoadFailed message={t('audit.failed')} error={query.error} onRetry={() => void query.refetch()} />}

      {!jobId && <AuditTable entries={entries} busy={query.isFetching} pending={plan.ok && query.isPending} empty={!query.isPending && entries.length === 0} onOpen={setOpen} />}
      {!jobId && entries.length > 0 && <p className="text-xs text-aura-muted">{t('audit.shown', { count: entries.length })}</p>}
      {query.hasNextPage && (
        <button type="button" className={`${btnOutline} self-start`} disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
          {t('audit.loadMore')}
        </button>
      )}

      {open && <EntryDialog row={open} actor={actorName(open)} onClose={() => setOpen(undefined)} />}
    </section>
  )
}
