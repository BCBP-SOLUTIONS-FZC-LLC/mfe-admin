// The filters that are applied, as removable chips under the filter form, so a search can be narrowed or
// widened without opening the form: each chip names the filter and its value (an actor by name, never
// by ID) and removing it applies the rest at once.
import { formatDate } from '@bcbp-solutions-fzc-llc/frontend-sdk/i18n'
import { useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { useMemo } from 'react'
import type { AuditFilter } from '../../../domain/value-objects/AuditFilter'
import { APP_ID } from '../../../shared/constants/app'
import { useUserProfiles } from '../../features/identity/useUserProfiles'

const ACTOR_TYPE_KEYS = { user: 'audit.actorType.user', service_account: 'audit.actorType.service_account', iam_system: 'audit.actorType.iam_system', anonymous: 'audit.actorType.anonymous' } as const
const TIER_KEYS = { compliance_7y: 'audit.tier.compliance_7y', security_3y: 'audit.tier.security_3y', access_90d: 'audit.tier.access_90d' } as const

export default function FilterChips({ filter, onChange }: { filter: AuditFilter; onChange: (next: AuditFilter) => void }) {
  const t = useT(APP_ID)
  const profiles = useUserProfiles(useMemo(() => (filter.actorId ? [filter.actorId] : []), [filter.actorId]))
  const actor = filter.actorId ? profiles.of(filter.actorId) : undefined
  const drop = (key: keyof AuditFilter) => () => {
    const next: Record<string, unknown> = { ...filter }
    delete next[key]
    if (key === 'entryTypes') next['entryTypes'] = []
    onChange(next as unknown as AuditFilter)
  }
  const when = (iso: string) => formatDate(iso, { dateStyle: 'medium', timeStyle: 'short' })

  const chips: { key: string; label: string; value: string; clear: () => void }[] = []
  const add = (key: string, label: string, value: string | undefined, clear: () => void) => value && chips.push({ key, label, value, clear })
  add('from', t('audit.filter.from'), filter.from && when(filter.from), drop('from'))
  add('to', t('audit.filter.to'), filter.to && when(filter.to), drop('to'))
  add('type', t('audit.filter.entryType'), filter.entryTypes[0], drop('entryTypes'))
  add('actor', t('audit.filter.actor'), filter.actorId && (actor?.state === 'found' ? actor.user.displayName : t('identity.nameUnavailable')), drop('actorId'))
  add('actorType', t('audit.filter.actorType'), filter.actorType && t(ACTOR_TYPE_KEYS[filter.actorType]), drop('actorType'))
  add('tier', t('audit.filter.retentionTier'), filter.retentionTier && t(TIER_KEYS[filter.retentionTier]), drop('retentionTier'))
  add('targetType', t('audit.filter.targetType'), filter.targetType, drop('targetType'))
  add('targetId', t('audit.filter.targetId'), filter.targetId, drop('targetId'))
  add('source', t('audit.filter.sourceService'), filter.sourceService, drop('sourceService'))

  if (chips.length === 0) return null
  return (
    <ul aria-label={t('audit.chips')} className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <li key={c.key} className="inline-flex items-center gap-1.5 rounded-full bg-aura-secondary-soft py-1 ps-3 pe-1 text-xs text-aura-text">
          <span className="text-aura-muted">{c.label}:</span> <span className="font-medium">{c.value}</span>
          <button type="button" aria-label={`${t('audit.chip.remove')}: ${c.label}`} onClick={c.clear} className="flex size-5 cursor-pointer items-center justify-center rounded-full text-aura-muted hover:bg-aura-hover hover:text-aura-text">
            <span aria-hidden="true">×</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
