// E7's results: time, who, what, to what, from where. Who comes from the entry's own display name; a
// service account is "Automation" and the platform's own actor "System". An entry with no name for a
// person is looked up in User Profile, else "Unknown user": never a raw ID.
import { formatDate } from '@bcbp-solutions-fzc-llc/frontend-sdk/i18n'
import { useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { useMemo } from 'react'
import type { AuditEntry } from '../../../domain/entities/audit'
import { auditFamilyOf, type AuditFamily } from '../../../domain/vocabulary'
import { APP_ID } from '../../../shared/constants/app'
import Avatar from '../../components/identity/Avatar'
import { btnOutline, table, tableWrap, td, tdMessage, th, tr } from '../../components/styles'
import { useUserProfiles } from '../../features/identity/useUserProfiles'

const FAMILY_KEYS = {
  auth: 'audit.family.auth',
  membership: 'audit.family.membership',
  invitation: 'audit.family.invitation',
  tenant: 'audit.family.tenant',
  config: 'audit.family.config',
  delegation: 'audit.family.delegation',
  tender: 'audit.family.tender',
  workflow: 'audit.family.workflow',
  user: 'audit.family.user',
  serviceaccount: 'audit.family.serviceaccount',
  usage: 'audit.family.usage',
  billing: 'audit.family.billing',
  legal: 'audit.family.legal',
  security: 'audit.family.security',
} as const satisfies Record<AuditFamily, string>

/** One tint per family, so the rows can be scanned by kind. */
const FAMILY_TINT: Record<AuditFamily, string> = {
  auth: 'bg-aura-tertiary-soft text-aura-text',
  membership: 'bg-aura-primary-soft text-[color:var(--aura-primary-on-soft)]',
  invitation: 'bg-aura-primary-soft text-[color:var(--aura-primary-on-soft)]',
  tenant: 'bg-aura-secondary-soft text-[color:var(--aura-secondary-on-soft)]',
  config: 'bg-aura-secondary-soft text-[color:var(--aura-secondary-on-soft)]',
  delegation: 'bg-aura-accent-amber-soft text-aura-text',
  tender: 'bg-aura-accent-amber-soft text-aura-text',
  workflow: 'bg-aura-accent-amber-soft text-aura-text',
  user: 'bg-aura-primary-soft text-[color:var(--aura-primary-on-soft)]',
  serviceaccount: 'bg-aura-tertiary-soft text-aura-text',
  usage: 'bg-aura-hover text-aura-text',
  billing: 'bg-aura-hover text-aura-text',
  legal: 'bg-aura-hover text-aura-text',
  security: 'bg-aura-accent-coral-soft text-aura-text',
}

/** An entry type as a pill (its family's plain word) with the exact type beside it. */
export function EntryTypePill({ entryType }: { entryType: string }) {
  const t = useT(APP_ID)
  const family = auditFamilyOf(entryType)
  const tint = family ? FAMILY_TINT[family] : 'bg-aura-hover text-aura-text'
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${tint}`}>{entryTypeLabel(t, entryType)}</span>
}

const ACTOR_KEYS = { service_account: 'audit.actorType.service_account', iam_system: 'audit.actorType.iam_system', anonymous: 'audit.actorType.anonymous' } as const

/** The family's plain word (Sign-in, Membership…), or the entry type itself for a family not on the list. */
export function entryTypeLabel(t: (key: string) => string, entryType: string): string {
  const family = auditFamilyOf(entryType)
  return family ? t(FAMILY_KEYS[family]) : entryType
}

/** Who did it, as the table and the dialog show them. */
export function useActorNames(entries: readonly AuditEntry[]): (entry: AuditEntry) => string {
  const t = useT(APP_ID)
  // People with no display name on the entry are asked of User Profile in one lookup.
  const unnamed = useMemo(() => entries.filter((e) => e.actor.type === 'user' && !e.actor.display && e.actor.id).map((e) => e.actor.id!), [entries])
  const profiles = useUserProfiles(unnamed)
  return (entry) => {
    const { type, display, id } = entry.actor
    if (type !== 'user') return t(ACTOR_KEYS[type])
    if (display) return display
    const p = id ? profiles.of(id) : undefined
    return p?.state === 'found' ? p.user.displayName : t('audit.unknownUser')
  }
}

export default function AuditTable({ entries, busy, pending, empty, onOpen }: { entries: readonly AuditEntry[]; busy: boolean; pending: boolean; empty: boolean; onOpen: (entry: AuditEntry) => void }) {
  const t = useT(APP_ID)
  const actorName = useActorNames(entries)
  return (
    <div className={tableWrap}>
      <table className={table} aria-busy={busy}>
        <thead>
          <tr>
            <th className={th}>{t('audit.col.time')}</th>
            <th className={th}>{t('audit.col.actor')}</th>
            <th className={th}>{t('audit.col.action')}</th>
            <th className={th}>{t('audit.col.entryType')}</th>
            <th className={th}>{t('audit.col.target')}</th>
            <th className={th}>{t('audit.col.source')}</th>
            <th className={th}>
              <span className="sr-only">{t('common.actions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {pending && (
            <tr className={tr}>
              <td colSpan={7} className={tdMessage}>{t('audit.loading')}</td>
            </tr>
          )}
          {!pending && empty && (
            <tr className={tr}>
              <td colSpan={7} className={tdMessage}>{t('audit.empty')}</td>
            </tr>
          )}
          {entries.map((e) => (
            <tr key={e.id} className={tr}>
              <td className={`${td} w-32 text-aura-muted`}>{formatDate(e.occurredAt, { dateStyle: 'medium', timeStyle: 'short' })}</td>
              <td className={`${td} whitespace-nowrap font-medium text-aura-text`}>
                <Avatar name={actorName(e)} className="me-2.5 !inline-flex align-middle" />
                {actorName(e)}
              </td>
              <td className={`${td} max-w-52 break-words font-medium text-aura-text`}>{e.action}</td>
              <td className={td}>
                <span className="flex flex-col items-start gap-1">
                  <EntryTypePill entryType={e.entryType} />
                  <code className="max-w-60 break-words text-xs text-aura-muted">{e.entryType}</code>
                </span>
              </td>
              <td className={`${td} max-w-40 break-words text-aura-muted`}>{[e.target?.type, e.target?.id].filter(Boolean).join(' ')}</td>
              <td className={td}>
                <span className="rounded-md border border-aura-border px-2 py-0.5 text-xs font-medium text-aura-muted">{e.sourceService}</span>
              </td>
              <td className={`${td} text-end`}>
                <button type="button" className={btnOutline} aria-label={`${t('audit.details')}: ${e.action}`} onClick={() => onOpen(e)}>
                  {t('audit.details')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
