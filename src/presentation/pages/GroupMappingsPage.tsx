// E5 Group mappings (Pro and Enterprise): which department, level and role an identity-provider group
// grants at SSO sign-in. Gated by the plan: a trial workspace (the shared realm has no SSO) and a
// Starter workspace are told so; the editor shows for Pro and Enterprise. Mappings only ever add
// access, and apply at each person's next SSO sign-in: the page says both.
import { useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { useState } from 'react'
import { APP_ID } from '../../shared/constants/app'
import LoadFailed from '../components/LoadFailed'
import { btnPrimary, card } from '../components/styles'
import { useAdminAccess } from '../features/access/useAdminAccess'
import { useDepartmentDirectory } from '../features/identity/useDepartmentDirectory'
import { useAdminServices } from '../features/services'
import { useGroupMappings } from '../features/mappings/useGroupMappings'
import { useTenantSettings } from '../features/settings/useSettings'
import DepartmentMappings from './mappings/DepartmentMappings'
import RoleMappings from './mappings/RoleMappings'

export default function GroupMappingsPage() {
  const t = useT(APP_ID)
  const access = useAdminAccess()
  const { navigation } = useAdminServices()
  const directory = useDepartmentDirectory()
  const tenant = useTenantSettings()
  // "Saved" notices live here, not in the tables: a save reloads the lists and the tables are keyed by what the service returned.
  const [saved, setSaved] = useState<'departments' | 'roles' | undefined>()

  // The plan decides (until the sso_enabled flag reaches the session context, IAM gap G-10): never a role.
  const status = tenant.data?.status
  const plan = tenant.data?.plan
  const gate = tenant.isError ? 'unknown' : !tenant.data ? 'loading' : status === 'trial' ? 'trial' : plan === 'starter' ? 'upgrade' : 'open'
  const mappings = useGroupMappings(gate === 'open')

  const notice = `${card} flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-aura-text`

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-aura-text">{t('mappings.title')}</h1>
        <p className="mt-1 text-sm text-aura-muted">{t('mappings.subtitle')}</p>
      </div>
      {access.readOnly && <p role="status" className="w-fit rounded-lg bg-aura-accent-amber-soft px-4 py-2 text-sm text-aura-text">{t('mappings.readOnly')}</p>}
      {gate === 'loading' && <p className="text-aura-muted">{t('mappings.loading')}</p>}
      {gate === 'unknown' && <LoadFailed message={t('mappings.settingsFailed')} error={tenant.error} onRetry={() => void tenant.refetch()} />}
      {gate === 'trial' && (
        <div role="status" className={notice}>
          <span>{t('mappings.trial')}</span>
          {access.canManageSso && (
            <button type="button" className={btnPrimary} onClick={navigation.upgrade}>
              {t('users.seats.upgrade')}
            </button>
          )}
        </div>
      )}
      {gate === 'upgrade' && (
        <div role="status" className={notice}>
          <span>
            <span className="font-semibold">{t('mappings.upgradeTitle')}</span> {t('mappings.upgrade')}
          </span>
          {access.canManageSso && (
            <button type="button" className={btnPrimary} onClick={navigation.upgrade}>
              {t('users.seats.upgrade')}
            </button>
          )}
        </div>
      )}
      {gate === 'open' && (
        <>
          <div className="flex flex-col gap-1 rounded-xl border border-aura-border bg-aura-secondary-soft p-4 text-sm text-aura-text">
            <p>{t('mappings.how')}</p>
            <p className="text-aura-muted">{t('mappings.additive')}</p>
          </div>
          {mappings.isError && <LoadFailed message={t('mappings.failed')} error={mappings.error} onRetry={() => void mappings.refetch()} />}
          {mappings.isPending && <p className="text-aura-muted">{t('mappings.loading')}</p>}
          {mappings.data && (
            <>
              <DepartmentMappings
                key={`d-${JSON.stringify([mappings.data.departments, mappings.data.levels])}`}
                current={mappings.data}
                access={access}
                directory={directory}
                saved={saved === 'departments'}
                onSaved={() => setSaved('departments')}
                onEdit={() => setSaved(undefined)}
                onReload={() => void mappings.refetch()}
              />
              <RoleMappings
                key={`r-${JSON.stringify(mappings.data.tenantRoles)}`}
                current={mappings.data}
                access={access}
                saved={saved === 'roles'}
                onSaved={() => setSaved('roles')}
                onEdit={() => setSaved(undefined)}
                onReload={() => void mappings.refetch()}
              />
            </>
          )}
        </>
      )}
    </section>
  )
}
