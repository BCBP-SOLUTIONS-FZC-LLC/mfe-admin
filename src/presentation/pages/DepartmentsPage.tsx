// E3 Departments and role labels: the tenant's departments with their member counts, the catalogue to
// activate from, and the tenant's own labels for the three levels. Everyone may view; the changes
// need manage:members and a read-write workspace. The header counts what the tenant has and what the
// catalogue still offers, from the same queries the sections below use (one request each).
import { useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { APP_ID } from '../../shared/constants/app'
import { card } from '../components/styles'
import { useAdminAccess } from '../features/access/useAdminAccess'
import { useCatalog, useTenantDepartments } from '../features/departments/useDepartments'
import CatalogDepartments from './departments/CatalogDepartments'
import RoleLabelsCard from './departments/RoleLabelsCard'
import TenantDepartments from './departments/TenantDepartments'

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className={`${card} flex min-w-36 flex-col px-4 py-3`}>
      <span className="text-2xl font-semibold text-aura-text">{value}</span>
      <span className="text-xs text-aura-muted">{label}</span>
    </div>
  )
}

export default function DepartmentsPage() {
  const t = useT(APP_ID)
  const access = useAdminAccess()
  const mine = useTenantDepartments()
  const catalog = useCatalog()
  const owned = new Set((mine.data ?? []).map((d) => d.departmentId))
  const stats = mine.data && catalog.data ? { active: mine.data.filter((d) => d.isActive).length, retired: mine.data.filter((d) => !d.isActive).length, available: catalog.data.filter((d) => !owned.has(d.departmentId)).length } : undefined
  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold text-aura-text">{t('departments.title')}</h1>
          <p className="mt-1 text-sm text-aura-muted">{t('departments.subtitle')}</p>
        </div>
        {stats && (
          <div className="flex flex-wrap gap-3">
            <Stat value={stats.active} label={t('departments.stat.active')} />
            <Stat value={stats.retired} label={t('departments.stat.retired')} />
            <Stat value={stats.available} label={t('departments.stat.available')} />
          </div>
        )}
        {access.readOnly && <p role="status" className="w-fit rounded-lg bg-aura-accent-amber-soft px-4 py-2 text-sm text-aura-text">{t('departments.readOnly')}</p>}
      </div>
      <TenantDepartments access={access} />
      <CatalogDepartments access={access} />
      <RoleLabelsCard access={access} />
    </section>
  )
}
