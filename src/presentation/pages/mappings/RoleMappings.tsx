// E5, "IdP group → tenant role" (GM-6). Owner mappings are an owner's: an admin sees them locked, can
// save the other rows beside them, and cannot add one.
import { useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { useId, useState } from 'react'
import type { GroupMappings } from '../../../domain/entities/groupMapping'
import { planGroupMappings } from '../../../domain/rules/admin-rules'
import { OWNER, TENANT_ROLES, type TenantRole } from '../../../domain/vocabulary'
import { APP_ID } from '../../../shared/constants/app'
import ConflictDialog from '../../components/ConflictDialog'
import ProblemDetails from '../../components/ProblemDetails'
import { btnOutline, btnPrimary, card, input } from '../../components/styles'
import { roleKey } from '../../components/identity/RoleBadge'
import type { AdminAccess } from '../../features/access/useAdminAccess'
import { useSaveTenantRoleMappings } from '../../features/mappings/useGroupMappings'
import { useAdminServices } from '../../features/services'
import { useProblemText } from '../../features/useProblemText'
import { MAPPING_FAILURE_KEYS, rowKey } from './shared'
import { GRID_ROLE, RowHeader } from './MappingRow'

interface Row {
  key: string
  groupName: string
  role: TenantRole
}

export default function RoleMappings({ current, access, saved, onSaved, onEdit, onReload }: { current: GroupMappings; access: AdminAccess; saved: boolean; onSaved: () => void; onEdit: () => void; onReload: () => void }) {
  const t = useT(APP_ID)
  const problemText = useProblemText()
  const { problems } = useAdminServices()
  const save = useSaveTenantRoleMappings()
  const id = useId()
  const [rows, setRows] = useState<Row[]>(() => current.tenantRoles.map((m) => ({ key: rowKey(), groupName: m.groupName, role: m.role })))
  const [invalid, setInvalid] = useState<string | undefined>()

  const isOwner = access.canManageAdminRoles
  const editable = access.canManageSso && !access.readOnly
  // The owner role is offered to an owner only; an owner row an admin did not make is locked.
  const offered = TENANT_ROLES.filter((r) => isOwner || r !== OWNER)
  const locked = (r: Row) => r.role === OWNER && !isOwner

  const edit = (key: string, patch: Partial<Row>) => {
    onEdit()
    save.reset()
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  const submit = () => {
    const plan = planGroupMappings({ departments: current.departments, levels: current.levels, tenantRoles: rows.map((r) => ({ groupName: r.groupName, role: r.role })) }, isOwner, current)
    if (!plan.ok) return setInvalid(MAPPING_FAILURE_KEYS[plan.failure])
    setInvalid(undefined)
    onEdit()
    // mutateAsync, not a callback passed to mutate: this card is keyed by the record's version, so a save remounts it while the refetch is in flight, and a callback passed to mutate is skipped for an unmounted component
    void save.mutateAsync(plan.value.tenantRoles).then(onSaved, () => {})
  }

  return (
    <section aria-labelledby={`${id}-title`} className={`${card} flex flex-col gap-3 p-5`}>
      <h2 id={`${id}-title`} className="text-lg font-semibold text-aura-text">
        {t('mappings.role.title')}
      </h2>
      {rows.length === 0 && <p className="rounded-lg border border-dashed border-aura-border px-4 py-6 text-center text-sm text-aura-muted">{t('mappings.role.empty')}</p>}
      {rows.length > 0 && <RowHeader grid={GRID_ROLE} columns={[t('mappings.role.group'), t('mappings.role.role')]} />}
      <ul className="flex flex-col gap-2">
        {rows.map((r, index) => (
          <li key={r.key} className={`${GRID_ROLE} items-center rounded-xl border border-aura-border bg-aura-surface p-2`}>
            <input aria-label={`${t('mappings.role.group')} ${index + 1}`} className={input} value={r.groupName} disabled={!editable || locked(r)} onChange={(e) => edit(r.key, { groupName: e.target.value })} />
            <select aria-label={`${t('mappings.role.role')} ${index + 1}`} className={input} value={r.role} disabled={!editable || locked(r)} onChange={(e) => edit(r.key, { role: e.target.value as TenantRole })}>
              {(locked(r) ? TENANT_ROLES : offered).map((role) => (
                <option key={role} value={role}>
                  {t(roleKey(role))}
                </option>
              ))}
            </select>
            {locked(r) ? (
              <span className="flex items-center gap-1.5 text-xs text-aura-muted"><svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>{t('mappings.role.ownerRow')}</span>
            ) : (
              editable && (
                <button type="button" className={`${btnOutline} justify-self-start`} aria-label={`${t('mappings.role.remove')} ${index + 1}`} onClick={() => (onEdit(), save.reset(), setRows((rs) => rs.filter((x) => x.key !== r.key)))}>
                  {t('mappings.role.remove')}
                </button>
              )
            )}
          </li>
        ))}
      </ul>
      {access.canManageSso && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={btnOutline} disabled={!editable} onClick={() => (onEdit(), save.reset(), setRows((rs) => [...rs, { key: rowKey(), groupName: '', role: offered[offered.length - 1]! }]))}>
            {t('mappings.role.add')}
          </button>
          <button type="button" className={btnPrimary} disabled={save.isPending || access.readOnly} title={access.readOnly ? t('mappings.readOnly') : undefined} onClick={submit}>
            {t('mappings.role.save')}
          </button>
        </div>
      )}
      {invalid && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {t(invalid)}
        </p>
      )}
      {save.isError && !problems.isConflict(save.error) && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm font-medium text-red-600">
          <span>{problemText(save.error)}</span>
          <ProblemDetails error={save.error} />
        </div>
      )}
      {saved && <p role="status" className="rounded-lg bg-emerald-500/12 px-4 py-2 text-sm text-emerald-800 dark:text-emerald-200">{t('mappings.role.saved')}</p>}
      {save.isError && problems.isConflict(save.error) && (
        <ConflictDialog
          onClose={() => save.reset()}
          onReload={() => {
            save.reset()
            onReload()
          }}
        />
      )}
    </section>
  )
}
