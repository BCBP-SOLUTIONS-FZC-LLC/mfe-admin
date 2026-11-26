// E6 delegation policy block (DLG-6, DLG-7): the longest delegation and the review window, each
// 1 to 180 days. Everyone may read it (G3 bounds its date picker with it); an admin or owner changes it.
import { useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { useId, useState } from 'react'
import type { DelegationPolicy } from '../../../domain/entities/settings'
import { planDelegationPolicy } from '../../../domain/rules/admin-rules'
import { APP_ID } from '../../../shared/constants/app'
import ProblemDetails from '../../components/ProblemDetails'
import { btnPrimary, card, input } from '../../components/styles'
import { Field, SectionHeader } from './Field'
import type { AdminAccess } from '../../features/access/useAdminAccess'
import { usePutDelegationPolicy } from '../../features/settings/useSettings'
import { useProblemText } from '../../features/useProblemText'

export default function DelegationCard({ policy, access, saved, onSaved, onEdit }: { policy: DelegationPolicy; access: AdminAccess; saved: boolean; onSaved: () => void; onEdit: () => void }) {
  const t = useT(APP_ID)
  const problemText = useProblemText()
  const put = usePutDelegationPolicy()
  const id = useId()
  const [max, setMax] = useState(String(policy.maxDurationDays))
  const [review, setReview] = useState(String(policy.reviewWindowDays))
  const [invalid, setInvalid] = useState<string | undefined>()

  const manager = access.hasManageDelegationPolicy
  const editable = manager && !access.readOnly

  const submit = () => {
    const plan = planDelegationPolicy({ maxDurationDays: Number(max), reviewWindowDays: Number(review) })
    if (!plan.ok) return setInvalid(plan.at)
    setInvalid(undefined)
    onEdit()
    // mutateAsync, not a callback passed to mutate: this card is keyed by the record's version, so a save remounts it while the refetch is in flight, and a callback passed to mutate is skipped for an unmounted component
    void put.mutateAsync(plan.value).then(onSaved, () => {})
  }

  return (
    <section aria-labelledby={`${id}-title`} className={`${card} flex flex-col gap-5 p-5`}>
      <SectionHeader id={`${id}-title`} title={t('settings.delegation.title')} intro={t('settings.delegation.intro')} />
      {!manager && <p className="rounded-lg bg-aura-secondary-soft px-3 py-2 text-sm text-aura-text">{t('settings.delegation.adminOnly')}</p>}
      <p className="text-sm text-aura-muted">{t('settings.delegation.hint')}</p>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t('settings.delegation.max')} htmlFor={`${id}-max`}>
          <input id={`${id}-max`} type="number" min={1} max={180} className={input} value={max} disabled={!editable} aria-invalid={invalid === 'maxDurationDays'} onChange={(e) => (onEdit(), setMax(e.target.value))} />
        </Field>
        <Field label={t('settings.delegation.review')} htmlFor={`${id}-review`}>
          <input id={`${id}-review`} type="number" min={1} max={180} className={input} value={review} disabled={!editable} aria-invalid={invalid === 'reviewWindowDays'} onChange={(e) => (onEdit(), setReview(e.target.value))} />
        </Field>
      </div>
      {invalid && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {t('settings.delegation.error')}
        </p>
      )}
      {put.isError && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm font-medium text-red-600">
          <span>{problemText(put.error)}</span>
          <ProblemDetails error={put.error} />
        </div>
      )}
      {saved && <p role="status" className="rounded-lg bg-emerald-500/12 px-4 py-2 text-sm text-emerald-800 dark:text-emerald-200">{t('settings.delegation.saved')}</p>}
      {manager && (
        <button type="button" className={`${btnPrimary} self-start`} disabled={put.isPending || access.readOnly} title={access.readOnly ? t('settings.readOnly') : undefined} onClick={submit}>
          {t('settings.delegation.save')}
        </button>
      )}
    </section>
  )
}
