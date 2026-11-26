// E3's catalogue: departments the tenant has not activated, each with Activate (P-24). The catalogue
// is the same all session; a newly activated department can take up to 10 minutes to show everywhere
// (Org & Membership caches the catalogue), and the screen says so.
import { useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { useState } from 'react'
import { APP_ID } from '../../../shared/constants/app'
import LoadFailed from '../../components/LoadFailed'
import ProblemDetails from '../../components/ProblemDetails'
import { btnPrimary, card } from '../../components/styles'
import type { AdminAccess } from '../../features/access/useAdminAccess'
import { useActivateDepartment, useCatalog, useTenantDepartments } from '../../features/departments/useDepartments'
import { useProblemText } from '../../features/useProblemText'

export default function CatalogDepartments({ access }: { access: AdminAccess }) {
  const t = useT(APP_ID)
  const problemText = useProblemText()
  const catalog = useCatalog()
  const mine = useTenantDepartments()
  const activate = useActivateDepartment()
  const [notice, setNotice] = useState<string | undefined>()

  if (catalog.isError) return <LoadFailed message={t('departments.catalogFailed')} error={catalog.error} onRetry={() => void catalog.refetch()} />
  const owned = new Set((mine.data ?? []).map((d) => d.departmentId))
  const available = (catalog.data ?? []).filter((d) => !owned.has(d.departmentId))

  return (
    <section aria-labelledby="catalog-title" className="flex flex-col gap-3">
      <h2 id="catalog-title" className="text-lg font-semibold text-aura-text">
        {t('departments.catalog')}
      </h2>
      <p className="text-sm text-aura-muted">{t('departments.catalogHint')}</p>
      {notice && <p role="status" className="rounded-lg bg-emerald-500/12 px-4 py-2 text-sm text-emerald-800 dark:text-emerald-200">{notice}</p>}
      {activate.isError && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm font-medium text-red-600">
          <span>{problemText(activate.error)}</span>
          <ProblemDetails error={activate.error} />
        </div>
      )}
      {catalog.isPending && <p className="text-aura-muted">{t('departments.loading')}</p>}
      {!catalog.isPending && !mine.isPending && available.length === 0 && <p className="text-aura-muted">{t('departments.catalogEmpty')}</p>}
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {available.map((d) => (
          <li key={d.departmentId} className={`${card} flex items-center justify-between gap-3 p-4`}>
            <span className="min-w-0 font-medium text-aura-text">
              {d.name} <span className="text-sm font-normal text-aura-muted">({d.code})</span>
            </span>
            {access.hasManageMembers && (
              <button
                type="button"
                className={btnPrimary}
                disabled={access.readOnly || activate.isPending}
                title={access.readOnly ? t('departments.readOnly') : undefined}
                onClick={() => (setNotice(undefined), activate.mutate(d.departmentId, { onSuccess: () => setNotice(t('departments.activated', { name: d.name })) }))}
              >
                {t('departments.activate')}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
