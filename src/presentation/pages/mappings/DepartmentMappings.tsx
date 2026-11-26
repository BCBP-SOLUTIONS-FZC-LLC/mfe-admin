// E5, "IdP group → department + level": the common case. One row per group; saving writes two full
// replacement lists (departments, then levels). If the second write fails after the first went
// through, the screen says which part saved and offers to retry only the rest. A group needs both a
// department and a level to grant access: a half-set row is saved as it is, and the page says so.
import { useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { useId, useState } from 'react'
import type { GroupMappings } from '../../../domain/entities/groupMapping'
import { planGroupMappings } from '../../../domain/rules/admin-rules'
import { DEPARTMENT_LEVELS, type DepartmentLevel } from '../../../domain/vocabulary'
import { APP_ID } from '../../../shared/constants/app'
import ConflictDialog from '../../components/ConflictDialog'
import ProblemDetails from '../../components/ProblemDetails'
import { btnOutline, btnPrimary, card, input } from '../../components/styles'
import { useLevelText } from '../../components/identity/DepartmentLabel'
import type { AdminAccess } from '../../features/access/useAdminAccess'
import type { DepartmentDirectory } from '../../features/identity/useDepartmentDirectory'
import { useSaveDepartmentMappings } from '../../features/mappings/useGroupMappings'
import { useAdminServices } from '../../features/services'
import { useProblemText } from '../../features/useProblemText'
import { MAPPING_FAILURE_KEYS, rowKey } from './shared'
import { GRID_DEPT, RowHeader } from './MappingRow'

interface Row {
  key: string
  groupName: string
  departmentId: string
  level: DepartmentLevel | ''
}

/** The two server lists as one row per group (a group in only one list keeps the other half empty). */
function join(m: GroupMappings): Row[] {
  const rows = new Map<string, Row>()
  for (const d of m.departments) rows.set(d.groupName, { key: rowKey(), groupName: d.groupName, departmentId: d.departmentId, level: '' })
  for (const l of m.levels) {
    const row = rows.get(l.groupName)
    if (row) row.level = l.level
    else rows.set(l.groupName, { key: rowKey(), groupName: l.groupName, departmentId: '', level: l.level })
  }
  return [...rows.values()]
}

export default function DepartmentMappings({ current, access, directory, saved, onSaved, onEdit, onReload }: { current: GroupMappings; access: AdminAccess; directory: DepartmentDirectory; saved: boolean; onSaved: () => void; onEdit: () => void; onReload: () => void }) {
  const t = useT(APP_ID)
  const problemText = useProblemText()
  const { problems } = useAdminServices()
  const levelText = useLevelText(directory)
  const { mutation, departmentsSaved, forget } = useSaveDepartmentMappings()
  const id = useId()
  const [rows, setRows] = useState<Row[]>(() => join(current))
  const [invalid, setInvalid] = useState<string | undefined>()

  const editable = access.canManageSso && !access.readOnly
  const active = directory.departments.filter((d) => d.isActive)
  const nameOf = (departmentId: string) => directory.nameOf(departmentId) ?? t('identity.department')

  const edit = (key: string, patch: Partial<Row>) => {
    onEdit()
    forget()
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  const save = (skipDepartments: boolean) => {
    const plan = planGroupMappings(
      {
        departments: rows.filter((r) => r.departmentId).map((r) => ({ groupName: r.groupName, departmentId: r.departmentId })),
        levels: rows.filter((r) => r.level).map((r) => ({ groupName: r.groupName, level: r.level })),
        tenantRoles: current.tenantRoles,
      },
      access.canManageAdminRoles,
      current,
    )
    if (!plan.ok) return setInvalid(MAPPING_FAILURE_KEYS[plan.failure])
    setInvalid(undefined)
    onEdit()
    // mutateAsync, not a callback passed to mutate: this card is keyed by the record's version, so a save remounts it while the refetch is in flight, and a callback passed to mutate is skipped for an unmounted component
    void mutation.mutateAsync({ departments: plan.value.departments, levels: plan.value.levels, skipDepartments }).then(onSaved, () => {})
  }

  const half = rows.some((r) => (r.departmentId === '') !== (r.level === ''))

  return (
    <section aria-labelledby={`${id}-title`} className={`${card} flex flex-col gap-3 p-5`}>
      <div>
        <h2 id={`${id}-title`} className="text-lg font-semibold text-aura-text">
          {t('mappings.dept.title')}
        </h2>
        <p className="mt-1 text-sm text-aura-muted">{t('mappings.dept.hint')}</p>
      </div>
      {rows.length === 0 && <p className="rounded-lg border border-dashed border-aura-border px-4 py-6 text-center text-sm text-aura-muted">{t('mappings.dept.empty')}</p>}
      {rows.length > 0 && <RowHeader grid={GRID_DEPT} columns={[t('mappings.dept.group'), t('mappings.dept.department'), t('mappings.dept.level')]} />}
      <ul className="flex flex-col gap-2">
        {rows.map((r, index) => (
          <li key={r.key} className={`${GRID_DEPT} items-center rounded-xl border p-2 ${(r.departmentId === '') !== (r.level === '') ? 'border-amber-500/60 bg-aura-accent-amber-soft' : 'border-aura-border bg-aura-canvas'}`}>
            <input aria-label={`${t('mappings.dept.group')} ${index + 1}`} className={input} value={r.groupName} disabled={!editable} onChange={(e) => edit(r.key, { groupName: e.target.value })} />
            <select aria-label={`${t('mappings.dept.department')} ${index + 1}`} className={input} value={r.departmentId} disabled={!editable} onChange={(e) => edit(r.key, { departmentId: e.target.value })}>
              <option value="">{t('mappings.dept.none')}</option>
              {/* A mapped department the tenant no longer has active stays listed, so it is never silently dropped. */}
              {r.departmentId && !active.some((d) => d.departmentId === r.departmentId) && <option value={r.departmentId}>{nameOf(r.departmentId)}</option>}
              {active.map((d) => (
                <option key={d.departmentId} value={d.departmentId}>
                  {d.name}
                </option>
              ))}
            </select>
            <select aria-label={`${t('mappings.dept.level')} ${index + 1}`} className={input} value={r.level} disabled={!editable} onChange={(e) => edit(r.key, { level: e.target.value as DepartmentLevel | '' })}>
              <option value="">{t('mappings.dept.none')}</option>
              {DEPARTMENT_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {levelText(level)}
                </option>
              ))}
            </select>
            {editable && (
              <button type="button" className={`${btnOutline} justify-self-start`} aria-label={`${t('mappings.dept.remove')} ${index + 1}`} onClick={() => (onEdit(), forget(), setRows((rs) => rs.filter((x) => x.key !== r.key)))}>
                {t('mappings.dept.remove')}
              </button>
            )}
          </li>
        ))}
      </ul>
      {half && <p className="text-sm font-medium text-aura-text">{t('mappings.dept.hint')}</p>}
      {access.canManageSso && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={btnOutline} disabled={!editable} onClick={() => (onEdit(), forget(), setRows((rs) => [...rs, { key: rowKey(), groupName: '', departmentId: '', level: '' }]))}>
            {t('mappings.dept.add')}
          </button>
          <button type="button" className={btnPrimary} disabled={mutation.isPending || access.readOnly} title={access.readOnly ? t('mappings.readOnly') : undefined} onClick={() => save(false)}>
            {t('mappings.dept.save')}
          </button>
        </div>
      )}
      {invalid && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {t(invalid)}
        </p>
      )}
      {mutation.isError && !problems.isConflict(mutation.error) && (
        <div role="alert" className="flex flex-col gap-2 text-sm font-medium text-red-600">
          {departmentsSaved && <span>{t('mappings.dept.partial')}</span>}
          <span className="flex flex-wrap items-center gap-2">
            {problemText(mutation.error)}
            <ProblemDetails error={mutation.error} />
          </span>
          {departmentsSaved && (
            <button type="button" className={`${btnOutline} self-start`} disabled={mutation.isPending} onClick={() => save(true)}>
              {t('mappings.dept.retry')}
            </button>
          )}
        </div>
      )}
      {saved && <p role="status" className="rounded-lg bg-emerald-500/12 px-4 py-2 text-sm text-emerald-800 dark:text-emerald-200">{t('mappings.dept.saved')}</p>}
      {mutation.isError && problems.isConflict(mutation.error) && (
        <ConflictDialog
          onClose={() => forget()}
          onReload={() => {
            forget()
            onReload()
          }}
        />
      )}
    </section>
  )
}
