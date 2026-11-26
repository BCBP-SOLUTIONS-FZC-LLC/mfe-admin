// E7 exports (AL-3, AL-4): the exports this admin started, newest first, each followed until it is
// ready, failed or expired. A ready export's download link is fresh on each ask and short-lived, so
// "Refresh" asks again; the file itself stays available for 7 days.
import { formatDate, formatNumber } from '@bcbp-solutions-fzc-llc/frontend-sdk/i18n'
import { useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { isProblemError } from '@bcbp-solutions-fzc-llc/frontend-sdk/problem'
import { Link, useLocation } from 'react-router-dom'
import { APP_ID } from '../../shared/constants/app'
import { Pill, type Tone } from '../components/identity/MemberBadges'
import { btnOutline, btnPrimary, card } from '../components/styles'
import { useExportJob, useExportJobs } from '../features/audit/useAudit'
import { useProblemText } from '../features/useProblemText'

/** The service's download link is untrusted text: it becomes a link only when it is an https URL (never `javascript:` or `data:`). */
function isHttps(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

const STATUS_TONE: Record<'pending' | 'running' | 'ready' | 'failed' | 'expired', Tone> = { pending: 'warning', running: 'warning', ready: 'success', failed: 'danger', expired: 'danger' }
const STATUS_KEYS = { pending: 'exports.status.pending', running: 'exports.status.running', ready: 'exports.status.ready', failed: 'exports.status.failed', expired: 'exports.status.expired' } as const

function ExportRow({ exportId, onRemove }: { exportId: string; onRemove: () => void }) {
  const t = useT(APP_ID)
  const problemText = useProblemText()
  const job = useExportJob(exportId)
  const e = job.data
  const gone = job.isError && isProblemError(job.error) && job.error.status === 404

  return (
    <li className={`${card} flex flex-col gap-3 p-4`}>
      <div className="flex flex-wrap items-center gap-3">
        <code className="text-sm font-medium text-aura-text">{exportId}</code>
        {e && <Pill tone={STATUS_TONE[e.status]}>{t(STATUS_KEYS[e.status])}</Pill>}
        {job.isPending && <span className="text-sm text-aura-muted">{t('exports.checking')}</span>}
        {e?.createdAt && <span className="text-sm text-aura-muted">{t('exports.created', { date: formatDate(e.createdAt, { dateStyle: 'medium', timeStyle: 'short' }) })}</span>}
        {e?.rowCount !== undefined && <span className="text-sm text-aura-muted">{t('exports.rows', { count: formatNumber(e.rowCount) })}</span>}
      </div>
      {e?.status === 'ready' && (
        <div className="flex flex-wrap items-center gap-3">
          {e.downloadUrl && isHttps(e.downloadUrl) && (
            <a className={`${btnPrimary} no-underline`} href={e.downloadUrl} rel="noopener noreferrer">
              {t('exports.download')}
            </a>
          )}
          {e.expiresAt && <span className="text-sm text-aura-muted">{t('exports.expires', { date: formatDate(e.expiresAt, { dateStyle: 'medium' }) })}</span>}
        </div>
      )}
      {e?.status === 'failed' && e.error && <p className="text-sm font-medium text-red-600">{t('exports.reason', { reason: e.error })}</p>}
      {job.isError && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {gone ? t('exports.notFound') : `${t('exports.loadFailed')} ${problemText(job.error)}`}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" className={btnOutline} disabled={job.isFetching} onClick={() => void job.refetch()}>
          {t('exports.refresh')}
        </button>
        <button type="button" className={btnOutline} onClick={onRemove}>
          {t('exports.remove')}
        </button>
      </div>
    </li>
  )
}

export default function AuditExportsPage() {
  const t = useT(APP_ID)
  const { ids, remove } = useExportJobs()
  const started = (useLocation().state as { started?: boolean } | null)?.started
  return (
    <section className="flex flex-col gap-5">
      <Link to="/admin/audit" className="w-fit text-sm font-medium text-[color:var(--aura-primary-ink)] underline">
        {t('audit.back')}
      </Link>
      <div>
        <h1 className="text-xl font-semibold text-aura-text">{t('exports.title')}</h1>
        <p className="mt-1 text-sm text-aura-muted">{t('exports.hint')}</p>
      </div>
      {started && <p role="status" className="w-fit rounded-lg bg-emerald-500/12 px-4 py-2 text-sm text-emerald-800 dark:text-emerald-200">{t('audit.export.started')}</p>}
      {ids.length === 0 && <p className="rounded-xl border border-dashed border-aura-border px-4 py-10 text-center text-sm text-aura-muted">{t('exports.empty')}</p>}
      <ul className="flex flex-col gap-3">
        {ids.map((id) => (
          <ExportRow key={id} exportId={id} onRemove={() => remove(id)} />
        ))}
      </ul>
    </section>
  )
}
