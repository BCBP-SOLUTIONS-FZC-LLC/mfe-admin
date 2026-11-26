// E6 Tenant settings: two blocks with different owners. The workspace block (name, language, approver
// MFA freshness, local accounts, AI residency) is the owner's; the delegation policy block is an
// admin's or owner's. Each loads and fails on its own.
import { useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { useState } from 'react'
import { APP_ID } from '../../shared/constants/app'
import LoadFailed from '../components/LoadFailed'
import { useAdminAccess } from '../features/access/useAdminAccess'
import { useDelegationPolicy, useTenantSettings } from '../features/settings/useSettings'
import DelegationCard from './settings/DelegationCard'
import WorkspaceCard from './settings/WorkspaceCard'

export default function SettingsPage() {
  const t = useT(APP_ID)
  const access = useAdminAccess()
  const settings = useTenantSettings()
  const policy = useDelegationPolicy()
  // The "saved" notices live here, not in the cards: a save changes the record's version, which
  // reloads the card's form (it is keyed by the version), and a notice kept inside would be lost with it.
  const [saved, setSaved] = useState<'workspace' | 'policy' | undefined>()

  return (
    <section className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-aura-text">{t('settings.title')}</h1>
        <p className="mt-1 text-sm text-aura-muted">{t('settings.subtitle')}</p>
      </div>
      {access.readOnly && <p role="status" className="w-fit rounded-lg bg-aura-accent-amber-soft px-4 py-2 text-sm text-aura-text">{t('settings.readOnly')}</p>}

      {settings.isError && <LoadFailed message={t('settings.workspace.failed')} error={settings.error} onRetry={() => void settings.refetch()} />}
      {settings.isPending && <p className="text-aura-muted">{t('settings.loading')}</p>}
      {settings.data && <WorkspaceCard key={settings.data.recordVersion} settings={settings.data} access={access} saved={saved === 'workspace'} onSaved={() => setSaved('workspace')} onEdit={() => setSaved(undefined)} onReload={() => void settings.refetch()} />}

      {policy.isError && <LoadFailed message={t('settings.delegation.failed')} error={policy.error} onRetry={() => void policy.refetch()} />}
      {policy.isPending && <p className="text-aura-muted">{t('settings.loading')}</p>}
      {policy.data && <DelegationCard key={`${policy.data.maxDurationDays}-${policy.data.reviewWindowDays}`} policy={policy.data} access={access} saved={saved === 'policy'} onSaved={() => setSaved('policy')} onEdit={() => setSaved(undefined)} />}
    </section>
  )
}
