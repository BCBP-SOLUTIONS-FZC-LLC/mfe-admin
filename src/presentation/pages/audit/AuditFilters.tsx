// E7's filter form. The applied filter lives in the URL (so a link or a reload keeps it); this form
// edits a copy and applies it on demand. Times are the viewer's local time, sent as UTC.
import { useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { useId, useState } from 'react'
import { ACTOR_TYPES, RETENTION_TIERS, EMPTY_AUDIT_FILTER, type ActorType, type AuditFilter, type RetentionTier } from '../../../domain/value-objects/AuditFilter'
import { APP_ID } from '../../../shared/constants/app'
import MemberPicker from '../../components/identity/MemberPicker'
import { btnOutline, btnPrimary, card, input } from '../../components/styles'
import { fromInputValue, toInputValue } from './datetime'

const ACTOR_KEYS = { user: 'audit.actorType.user', service_account: 'audit.actorType.service_account', iam_system: 'audit.actorType.iam_system', anonymous: 'audit.actorType.anonymous' } as const satisfies Record<ActorType, string>
const TIER_KEYS = { compliance_7y: 'audit.tier.compliance_7y', security_3y: 'audit.tier.security_3y', access_90d: 'audit.tier.access_90d' } as const satisfies Record<RetentionTier, string>

export default function AuditFilters({ filter, onApply }: { filter: AuditFilter; onApply: (next: AuditFilter) => void }) {
  const t = useT(APP_ID)
  const id = useId()
  const [from, setFrom] = useState(toInputValue(filter.from))
  const [to, setTo] = useState(toInputValue(filter.to))
  const [entryType, setEntryType] = useState(filter.entryTypes[0] ?? '')
  const [actorId, setActorId] = useState(filter.actorId ?? '')
  const [actorType, setActorType] = useState<string>(filter.actorType ?? '')
  const [targetType, setTargetType] = useState(filter.targetType ?? '')
  const [targetId, setTargetId] = useState(filter.targetId ?? '')
  const [sourceService, setSourceService] = useState(filter.sourceService ?? '')
  const [tier, setTier] = useState<string>(filter.retentionTier ?? '')

  const apply = () => {
    const f = fromInputValue(from)
    const to_ = fromInputValue(to)
    const type = entryType.trim()
    const next: AuditFilter = {
      entryTypes: type ? [type] : [],
      ...(f ? { from: f } : {}),
      ...(to_ ? { to: to_ } : {}),
      ...(actorId ? { actorId } : {}),
      ...(ACTOR_TYPES.find((a) => a === actorType) ? { actorType: actorType as ActorType } : {}),
      ...(targetType.trim() ? { targetType: targetType.trim() } : {}),
      ...(targetId.trim() ? { targetId: targetId.trim() } : {}),
      ...(sourceService.trim() ? { sourceService: sourceService.trim() } : {}),
      ...(RETENTION_TIERS.find((r) => r === tier) ? { retentionTier: tier as RetentionTier } : {}),
    }
    onApply(next)
  }

  const clear = () => {
    for (const set of [setFrom, setTo, setEntryType, setActorId, setActorType, setTargetType, setTargetId, setSourceService, setTier]) set('')
    onApply(EMPTY_AUDIT_FILTER)
  }

  const group = 'flex flex-col gap-3'
  const legend = 'text-xs font-semibold uppercase tracking-wide text-aura-muted'
  const field = 'flex flex-col gap-1.5 text-sm font-medium text-aura-text'

  return (
    <form
      aria-label={t('audit.filters')}
      className={`${card} grid gap-5 p-4 md:grid-cols-2 xl:grid-cols-4`}
      onSubmit={(e) => {
        e.preventDefault()
        apply()
      }}
    >
      <div className={group}>
        <p className={legend}>{t('audit.filter.group.time')}</p>
        <label className={field} htmlFor={`${id}-from`}>
          {t('audit.filter.from')}
          <input id={`${id}-from`} type="datetime-local" className={input} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className={field} htmlFor={`${id}-to`}>
          {t('audit.filter.to')}
          <input id={`${id}-to`} type="datetime-local" className={input} value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      <div className={group}>
        <p className={legend}>{t('audit.filter.group.who')}</p>
        <MemberPicker label={t('audit.filter.actor')} value={actorId} onChange={setActorId} includeSuspended emptyLabel={t('audit.filter.any')} />
        <label className={field} htmlFor={`${id}-actor-type`}>
          {t('audit.filter.actorType')}
          <select id={`${id}-actor-type`} className={input} value={actorType} onChange={(e) => setActorType(e.target.value)}>
            <option value="">{t('audit.filter.any')}</option>
            {ACTOR_TYPES.map((a) => (
              <option key={a} value={a}>
                {t(ACTOR_KEYS[a])}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={group}>
        <p className={legend}>{t('audit.filter.group.what')}</p>
        <div className="flex flex-col gap-1.5">
          <label className={field} htmlFor={`${id}-type`}>
            {t('audit.filter.entryType')}
            <input id={`${id}-type`} className={input} value={entryType} aria-describedby={`${id}-type-hint`} onChange={(e) => setEntryType(e.target.value)} />
          </label>
          <span id={`${id}-type-hint`} className="text-xs text-aura-muted">
            {t('audit.filter.entryTypeHint')}
          </span>
        </div>
        <label className={field} htmlFor={`${id}-tier`}>
          {t('audit.filter.retentionTier')}
          <select id={`${id}-tier`} className={input} value={tier} onChange={(e) => setTier(e.target.value)}>
            <option value="">{t('audit.filter.any')}</option>
            {RETENTION_TIERS.map((r) => (
              <option key={r} value={r}>
                {t(TIER_KEYS[r])}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={group}>
        <p className={legend}>{t('audit.filter.group.where')}</p>
        <label className={field} htmlFor={`${id}-target-type`}>
          {t('audit.filter.targetType')}
          <input id={`${id}-target-type`} className={input} value={targetType} onChange={(e) => setTargetType(e.target.value)} />
        </label>
        <label className={field} htmlFor={`${id}-target-id`}>
          {t('audit.filter.targetId')}
          <input id={`${id}-target-id`} className={input} value={targetId} onChange={(e) => setTargetId(e.target.value)} />
        </label>
        <label className={field} htmlFor={`${id}-source`}>
          {t('audit.filter.sourceService')}
          <input id={`${id}-source`} className={input} value={sourceService} onChange={(e) => setSourceService(e.target.value)} />
        </label>
      </div>
      <div className="flex items-end gap-2 md:col-span-2 xl:col-span-4">
        <button type="submit" className={btnPrimary}>
          {t('audit.filter.apply')}
        </button>
        <button type="button" className={btnOutline} onClick={clear}>
          {t('audit.filter.clear')}
        </button>
      </div>
    </form>
  )
}
