// E3 role labels (P-12, P-13): the tenant's own name for each department level. The code never
// changes; only the label does. Each row saves on its own, with the version it was read at.
import { useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { useState } from 'react'
import type { RoleLabel } from '../../../domain/entities/department'
import { planRoleLabel, type RoleLabelFailure } from '../../../domain/rules/admin-rules'
import { DEPARTMENT_LEVELS } from '../../../domain/vocabulary'
import { APP_ID } from '../../../shared/constants/app'
import ConflictDialog from '../../components/ConflictDialog'
import LoadFailed from '../../components/LoadFailed'
import ProblemDetails from '../../components/ProblemDetails'
import { btnOutline, card, input } from '../../components/styles'
import type { AdminAccess } from '../../features/access/useAdminAccess'
import { useRenameRoleLabel, useRoleLabelList } from '../../features/departments/useDepartments'
import { useAdminServices } from '../../features/services'
import { useProblemText } from '../../features/useProblemText'

const FAILURE_KEYS = { 'name-required': 'labels.error.name', 'name-too-long': 'labels.error.nameLong', 'no-change': 'labels.error.noChange' } as const satisfies Record<RoleLabelFailure, string>
/** The three levels in their own tints, as the role pills on the users screen. */
const LEVEL_TINT = {
  preparator: 'bg-aura-tertiary-soft text-aura-text',
  reviewer: 'bg-aura-secondary-soft text-[color:var(--aura-secondary-on-soft)]',
  approver: 'bg-aura-primary-soft text-[color:var(--aura-primary-on-soft)]',
} as const

const LEVEL_KEYS = { preparator: 'identity.level.preparator', reviewer: 'identity.level.reviewer', approver: 'identity.level.approver' } as const

function Row({ label, access, saved, onSaved, onEdit, onReload }: { label: RoleLabel; access: AdminAccess; saved: boolean; onSaved: () => void; onEdit: () => void; onReload: () => void }) {
  const t = useT(APP_ID)
  const problemText = useProblemText()
  const { problems } = useAdminServices()
  const rename = useRenameRoleLabel()
  const [draft, setDraft] = useState(label.displayName)
  const [invalid, setInvalid] = useState<RoleLabelFailure | undefined>()
  const level = t(LEVEL_KEYS[label.roleCode])

  const save = () => {
    const plan = planRoleLabel(draft, label)
    if (!plan.ok) return setInvalid(plan.failure)
    setInvalid(undefined)
    onEdit()
    // mutateAsync, not a callback passed to mutate: this card is keyed by the record's version, so a save remounts it while the refetch is in flight, and a callback passed to mutate is skipped for an unmounted component
    void rename.mutateAsync(plan.value).then(onSaved, () => {})
  }

  return (
    <li className={`${card} flex flex-col gap-3 p-4`}>
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${LEVEL_TINT[label.roleCode]}`}>{level}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input aria-label={`${t('labels.label')}: ${level}`} className={`${input} min-w-0 flex-1`} value={draft} disabled={!access.canManageMembers} onChange={(e) => (onEdit(), setDraft(e.target.value))} />
        {access.hasManageMembers && (
          <button type="button" className={btnOutline} disabled={access.readOnly || rename.isPending} title={access.readOnly ? t('departments.readOnly') : undefined} aria-label={`${t('labels.save')}: ${level}`} onClick={save}>
            {t('labels.save')}
          </button>
        )}
      </div>
      {invalid && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {t(FAILURE_KEYS[invalid])}
        </p>
      )}
      {rename.isError && !problems.isConflict(rename.error) && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm font-medium text-red-600">
          <span>{problemText(rename.error)}</span>
          <ProblemDetails error={rename.error} />
        </div>
      )}
      {saved && <p role="status" className="text-sm text-emerald-800 dark:text-emerald-200">{t('labels.saved', { level })}</p>}
      {rename.isError && problems.isConflict(rename.error) && (
        <ConflictDialog
          onClose={() => rename.reset()}
          onReload={() => {
            rename.reset()
            onReload()
          }}
        />
      )}
    </li>
  )
}

export default function RoleLabelsCard({ access }: { access: AdminAccess }) {
  const t = useT(APP_ID)
  const labels = useRoleLabelList()
  // Which level's "saved" notice is showing: kept here, because a save changes the row's version and its row remounts.
  const [saved, setSaved] = useState<string | undefined>()
  if (labels.isError) return <LoadFailed message={t('labels.failed')} error={labels.error} onRetry={() => void labels.refetch()} />
  const byCode = new Map((labels.data ?? []).map((l) => [l.roleCode, l]))
  return (
    <section aria-labelledby="labels-title" className="flex flex-col gap-3">
      <h2 id="labels-title" className="text-lg font-semibold text-aura-text">
        {t('labels.title')}
      </h2>
      <p className="text-sm text-aura-muted">{t('labels.hint')}</p>
      {labels.isPending && <p className="text-aura-muted">{t('common.loading')}</p>}
      <ul className="grid gap-3 md:grid-cols-3">
        {DEPARTMENT_LEVELS.map((code) => byCode.get(code)).filter((l): l is RoleLabel => l !== undefined).map((label) => (
          <Row key={`${label.roleCode}-${label.recordVersion}`} label={label} access={access} saved={saved === label.roleCode} onSaved={() => setSaved(label.roleCode)} onEdit={() => setSaved(undefined)} onReload={() => void labels.refetch()} />
        ))}
      </ul>
    </section>
  )
}
