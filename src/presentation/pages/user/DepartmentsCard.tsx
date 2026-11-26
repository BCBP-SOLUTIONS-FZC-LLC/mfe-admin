// E2 departments (P-9, P-10, P-11): add one, change a level, remove one. Only the tenant's active
// departments can be added. A demotion or a removal runs the impact review first (E2a): the
// confirmation says the workflow check is not available in advance yet, and a `409` asks what to do
// with the work the member covers.
import { useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { useState } from 'react'
import type { Member } from '../../../domain/entities/member'
import { planDepartmentAssignment, planDepartmentRemoval } from '../../../domain/rules/admin-rules'
import { DEPARTMENT_LEVELS, type DepartmentLevel } from '../../../domain/vocabulary'
import { APP_ID } from '../../../shared/constants/app'
import ConfirmDialog from '../../components/ConfirmDialog'
import { useLevelText } from '../../components/identity/DepartmentLabel'
import type { AdminAccess } from '../../features/access/useAdminAccess'
import type { DepartmentDirectory } from '../../features/identity/useDepartmentDirectory'
import { useAssignDepartment, useRemoveFromDepartment } from '../../features/members/useMemberDetail'
import type { Resolvable } from '../../features/members/useResolvableAction'

type Pending = { kind: 'demote'; departmentId: string; level: DepartmentLevel } | { kind: 'remove'; departmentId: string }

export default function DepartmentsCard({ member, name, access, directory, resolvable }: { member: Member; name: string; access: AdminAccess; directory: DepartmentDirectory; resolvable: Resolvable }) {
  const t = useT(APP_ID)
  const levelText = useLevelText(directory)
  const assign = useAssignDepartment(member.userId)
  const remove = useRemoveFromDepartment(member.userId)
  const [pending, setPending] = useState<Pending | undefined>()
  const [error, setError] = useState<unknown>()
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newDepartment, setNewDepartment] = useState('')
  const [newLevel, setNewLevel] = useState<DepartmentLevel>(DEPARTMENT_LEVELS[0])
  const [refused, setRefused] = useState<'detail.departments.error.inactive' | 'detail.departments.error.notAssigned' | undefined>()

  const editable = access.canManageMembers
  const activeIds = new Set(directory.departments.filter((d) => d.isActive).map((d) => d.departmentId))
  const assigned = new Set(member.departments.map((d) => d.departmentId))
  const addable = directory.departments.filter((d) => d.isActive && !assigned.has(d.departmentId))
  const nameOf = (id: string) => directory.nameOf(id) ?? t('identity.department')

  const execute = async (call: () => Promise<unknown>) => {
    setBusy(true)
    setError(undefined)
    try {
      const outcome = await resolvable.run(call)
      // Done, or blocked (the resolution dialog takes over): either way this confirmation is finished.
      // A blocked call is not a failure: clear the mutation's error so no generic alert stays behind the dialog (or after Cancel).
      if (outcome === 'blocked') {
        assign.reset()
        remove.reset()
      }
      setPending(undefined)
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  const changeLevel = (departmentId: string, level: DepartmentLevel) => {
    const plan = planDepartmentAssignment({ departmentId, level, current: member.departments, activeDepartmentIds: activeIds })
    if (!plan.ok) return setRefused('detail.departments.error.inactive')
    setRefused(undefined)
    if (plan.value.needsImpactReview) return setPending({ kind: 'demote', departmentId, level })
    void assign.mutateAsync({ departmentId, level }).catch(() => {})
  }

  const add = () => {
    const departmentId = newDepartment || addable[0]?.departmentId
    if (!departmentId) return
    const plan = planDepartmentAssignment({ departmentId, level: newLevel, current: member.departments, activeDepartmentIds: activeIds })
    if (!plan.ok) return setRefused('detail.departments.error.inactive')
    setRefused(undefined)
    void assign.mutateAsync({ departmentId, level: newLevel }).then(() => (setAdding(false), setNewDepartment('')), () => {})
  }

  const askRemove = (departmentId: string) => {
    const plan = planDepartmentRemoval({ departmentId, current: member.departments })
    if (!plan.ok) return setRefused('detail.departments.error.notAssigned')
    setRefused(undefined)
    setPending({ kind: 'remove', departmentId })
  }

  return (
    <section aria-labelledby="departments-title" className="flex flex-col gap-2">
      <h2 id="departments-title" className="text-lg font-semibold">
        {t('detail.departments.title')}
      </h2>
      {member.departments.length === 0 && <p className="text-base-content/70">{t('detail.departments.none')}</p>}
      <ul className="flex flex-col gap-2">
        {member.departments.map((d) => (
          <li key={d.departmentId} className="flex flex-wrap items-center gap-2">
            <span className="min-w-40">{nameOf(d.departmentId)}</span>
            <select
              aria-label={`${t('detail.departments.change')}: ${nameOf(d.departmentId)}`}
              className="select select-sm"
              value={d.level}
              disabled={!editable}
              onChange={(e) => changeLevel(d.departmentId, e.target.value as DepartmentLevel)}
            >
              {DEPARTMENT_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {levelText(level)}
                </option>
              ))}
            </select>
            {editable && (
              <button type="button" className="btn btn-ghost btn-sm" aria-label={`${t('detail.departments.remove')}: ${nameOf(d.departmentId)}`} onClick={() => askRemove(d.departmentId)}>
                {t('detail.departments.remove')}
              </button>
            )}
          </li>
        ))}
      </ul>
      {refused && (
        <p role="alert" className="text-error">
          {t(refused)}
        </p>
      )}
      {assign.isError && !pending && (
        <p role="alert" className="text-error">
          {t('errors.generic')}
        </p>
      )}
      {editable && !adding && (
        <button type="button" className="btn btn-sm self-start" disabled={addable.length === 0} onClick={() => (setAdding(true), setNewDepartment(addable[0]?.departmentId ?? ''))}>
          {t('detail.departments.add')}
        </button>
      )}
      {editable && adding && (
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label={t('detail.departments.pick')} className="select select-sm" value={newDepartment} onChange={(e) => setNewDepartment(e.target.value)}>
            {addable.map((d) => (
              <option key={d.departmentId} value={d.departmentId}>
                {d.name}
              </option>
            ))}
          </select>
          <select aria-label={t('detail.departments.level')} className="select select-sm" value={newLevel} onChange={(e) => setNewLevel(e.target.value as DepartmentLevel)}>
            {DEPARTMENT_LEVELS.map((level) => (
              <option key={level} value={level}>
                {levelText(level)}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-primary btn-sm" disabled={assign.isPending} onClick={add}>
            {t('detail.departments.save')}
          </button>
        </div>
      )}

      {pending?.kind === 'demote' && !resolvable.resolution.open && (
        <ConfirmDialog
          title={t('detail.departments.demoteTitle')}
          confirmLabel={t('detail.membership.confirm')}
          busy={busy}
          error={error}
          onCancel={() => (setPending(undefined), setError(undefined))}
          onConfirm={() => void execute(() => assign.mutateAsync({ departmentId: pending.departmentId, level: pending.level }))}
        >
          <p>{t('detail.departments.demoteBody', { name, level: levelText(pending.level), department: nameOf(pending.departmentId) })}</p>
          <p className="text-sm text-base-content/70">{t('detail.impactNotChecked')}</p>
        </ConfirmDialog>
      )}
      {pending?.kind === 'remove' && !resolvable.resolution.open && (
        <ConfirmDialog
          title={t('detail.departments.removeTitle')}
          confirmLabel={t('detail.departments.remove')}
          danger
          busy={busy}
          error={error}
          onCancel={() => (setPending(undefined), setError(undefined))}
          onConfirm={() => void execute(() => remove.mutateAsync(pending.departmentId))}
        >
          <p>{t('detail.departments.removeBody', { name, department: nameOf(pending.departmentId) })}</p>
          <p className="text-sm text-base-content/70">{t('detail.impactNotChecked')}</p>
        </ConfirmDialog>
      )}
    </section>
  )
}
