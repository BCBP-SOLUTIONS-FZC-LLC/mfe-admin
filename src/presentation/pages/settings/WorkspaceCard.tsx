// E6 workspace block (P-1, P-2): name, language, approver MFA freshness, local accounts and AI
// residency, an owner's to change; the plan and status are shown read-only. A save sends only what
// changed with the version it was read at. A `202` means the sign-in part is still applying: the
// screen says "Saving to sign-in settings…" and watches until it is done.
import { useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { useId, useState } from 'react'
import type { TenantSettings } from '../../../domain/entities/settings'
import { planTenantSettings, type TenantSettingsFailure } from '../../../domain/rules/admin-rules'
import { ENABLED_LOCALES } from '../../../domain/vocabulary'
import { APP_ID } from '../../../shared/constants/app'
import ConflictDialog from '../../components/ConflictDialog'
import ProblemDetails from '../../components/ProblemDetails'
import { Pill, type Tone } from '../../components/identity/MemberBadges'
import { btnPrimary, card, input } from '../../components/styles'
import { Field, SectionHeader, Switch } from './Field'
import type { AdminAccess } from '../../features/access/useAdminAccess'
import { useAdminServices } from '../../features/services'
import { useUpdateTenant } from '../../features/settings/useSettings'
import { useProblemText } from '../../features/useProblemText'

const FAILURE_KEYS = {
  'not-owner': 'settings.workspace.error.notOwner',
  'name-required': 'settings.workspace.error.name',
  'locale-invalid': 'settings.workspace.error.locale',
  'mfa-window-out-of-range': 'settings.workspace.error.mfa',
  'residency-invalid': 'settings.workspace.error.residency',
  'no-change': 'settings.workspace.error.noChange',
} as const satisfies Record<TenantSettingsFailure, string>

const PLAN_KEYS = { starter: 'settings.plan.starter', pro: 'settings.plan.pro', enterprise: 'settings.plan.enterprise' } as const
const STATUS_TONE: Record<TenantSettings['status'], Tone> = { trial: 'warning', active: 'success', past_due: 'warning', cancelled: 'danger', suspended: 'warning', trial_expired: 'danger', offboarded: 'danger' }
const STATUS_KEYS = {
  trial: 'settings.status.trial',
  active: 'settings.status.active',
  past_due: 'settings.status.past_due',
  cancelled: 'settings.status.cancelled',
  suspended: 'settings.status.suspended',
  trial_expired: 'settings.status.trial_expired',
  offboarded: 'settings.status.offboarded',
} as const

/** The catalogue's name for a language code (the shell enables English only so far); any other code shows as it is. */
const LANGUAGE_KEYS: Readonly<Record<string, string>> = { en: 'settings.language.en', fr: 'settings.language.fr' }

export default function WorkspaceCard({ settings, access, saved, onSaved, onEdit, onReload }: { settings: TenantSettings; access: AdminAccess; saved: boolean; onSaved: () => void; onEdit: () => void; onReload: () => void }) {
  const t = useT(APP_ID)
  const problemText = useProblemText()
  const { problems } = useAdminServices()
  const update = useUpdateTenant()
  const id = useId()
  const [name, setName] = useState(settings.name)
  const [locale, setLocale] = useState(settings.defaultLocale)
  const [mfa, setMfa] = useState(String(settings.mfaFreshnessSeconds))
  const [local, setLocal] = useState(settings.localAccountsEnabled)
  const [residency, setResidency] = useState<string>(settings.residencyMode)
  const [invalid, setInvalid] = useState<TenantSettingsFailure | undefined>()

  // The owner sees the block; a read-only workspace disables it, with the reason.
  const owner = access.hasManageTenantSettings
  const editable = owner && !access.readOnly
  const languages = ENABLED_LOCALES.includes(settings.defaultLocale as never) ? [...ENABLED_LOCALES] : [...ENABLED_LOCALES, settings.defaultLocale]

  const submit = () => {
    const plan = planTenantSettings({ name, defaultLocale: locale, mfaFreshnessSeconds: Number(mfa), localAccountsEnabled: local, residencyMode: residency }, settings, owner)
    if (!plan.ok) return setInvalid(plan.failure)
    setInvalid(undefined)
    onEdit()
    // mutateAsync, not a callback passed to mutate: this card is keyed by the record's version, so a save remounts it while the refetch is in flight, and a callback passed to mutate is skipped for an unmounted component
    void update.mutateAsync(plan.value).then(onSaved, () => {})
  }

  return (
    <section aria-labelledby={`${id}-title`} className={`${card} flex flex-col gap-5 p-5`}>
      <SectionHeader id={`${id}-title`} title={t('settings.workspace.title')} intro={t('settings.workspace.intro')} />
      {!owner && <p className="rounded-lg bg-aura-secondary-soft px-3 py-2 text-sm text-aura-text">{t('settings.workspace.ownerOnly')}</p>}
      <p className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg bg-aura-canvas px-4 py-3 text-sm">
        <span className="flex items-center gap-2">
          <span className="text-aura-muted">{t('settings.workspace.plan')}: </span>
          <span className="rounded-full bg-aura-primary-soft px-2.5 py-1 text-xs font-semibold text-[color:var(--aura-primary-on-soft)]">{t(PLAN_KEYS[settings.plan])}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="text-aura-muted">{t('settings.workspace.status')}: </span>
          <Pill tone={STATUS_TONE[settings.status]}>{t(STATUS_KEYS[settings.status])}</Pill>
        </span>
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t('settings.workspace.name')} htmlFor={`${id}-name`}>
          <input id={`${id}-name`} className={input} value={name} disabled={!editable} onChange={(e) => (onEdit(), setName(e.target.value))} />
        </Field>
        <Field label={t('settings.workspace.language')} htmlFor={`${id}-lang`}>
          <select id={`${id}-lang`} className={input} value={locale} disabled={!editable} onChange={(e) => (onEdit(), setLocale(e.target.value))}>
            {languages.map((l) => (
              <option key={l} value={l}>
                {LANGUAGE_KEYS[l] ? t(LANGUAGE_KEYS[l]) : l}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('settings.workspace.mfa')} htmlFor={`${id}-mfa`} hintId={`${id}-mfa-hint`} hint={t('settings.workspace.mfaHint')}>
          <input id={`${id}-mfa`} type="number" min={60} max={900} className={input} value={mfa} disabled={!editable} aria-describedby={`${id}-mfa-hint`} onChange={(e) => (onEdit(), setMfa(e.target.value))} />
        </Field>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-xl border border-aura-border p-4">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-local`} className="text-sm font-medium text-aura-text">
            {t('settings.workspace.local')}
          </label>
          <span id={`${id}-local-hint`} className="text-xs text-aura-muted">
            {t('settings.workspace.localHint')}
          </span>
        </div>
        <Switch id={`${id}-local`} checked={local} disabled={!editable} describedBy={`${id}-local-hint`} onChange={(v) => (onEdit(), setLocal(v))} />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-aura-text">{t('settings.workspace.residency')}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(['standard', 'strict'] as const).map((mode) => (
            <label
              key={mode}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition-colors ${
                residency === mode ? 'border-aura-primary bg-aura-primary-soft text-aura-text' : 'border-aura-border bg-aura-canvas text-aura-text hover:bg-aura-hover'
              } ${editable ? '' : 'cursor-not-allowed opacity-60'}`}
            >
              <input type="radio" name={`${id}-residency`} className="size-4 accent-[var(--aura-primary)]" checked={residency === mode} disabled={!editable} onChange={() => (onEdit(), setResidency(mode))} />
              {t(mode === 'standard' ? 'settings.workspace.residencyStandard' : 'settings.workspace.residencyStrict')}
            </label>
          ))}
        </div>
        {residency === 'strict' && <p className="text-sm text-aura-text">{t('settings.workspace.residencyWarn')}</p>}
      </fieldset>

      {invalid && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {t(FAILURE_KEYS[invalid])}
        </p>
      )}
      {update.isError && !problems.isConflict(update.error) && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm font-medium text-red-600">
          <span>{problemText(update.error)}</span>
          <ProblemDetails error={update.error} />
        </div>
      )}
      {/* The sign-in part of a save is applied in the background; this stays until the service says it is done. */}
      {settings.realmSyncPending && <p role="status" className="rounded-lg bg-aura-accent-amber-soft px-4 py-2 text-sm text-aura-text">{t('settings.workspace.applying')}</p>}
      {saved && !settings.realmSyncPending && <p role="status" className="rounded-lg bg-emerald-500/12 px-4 py-2 text-sm text-emerald-800 dark:text-emerald-200">{t('settings.workspace.saved')}</p>}
      {owner && (
        <button type="button" className={`${btnPrimary} self-start`} disabled={update.isPending || access.readOnly} title={access.readOnly ? t('settings.readOnly') : undefined} onClick={submit}>
          {t('settings.workspace.save')}
        </button>
      )}
      {update.isError && problems.isConflict(update.error) && (
        <ConflictDialog
          onClose={() => update.reset()}
          onReload={() => {
            update.reset()
            onReload()
          }}
        />
      )}
    </section>
  )
}
