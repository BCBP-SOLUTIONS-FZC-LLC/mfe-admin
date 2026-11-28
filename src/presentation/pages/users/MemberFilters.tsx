// The member list's filter form, shown in the filter drawer. It edits a copy and applies it on demand:
// "Apply filters" and "Clear" both hand the result to the list, which closes the drawer.
import { useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { useId, useState } from 'react'
import { TENANT_ROLES, type TenantRole } from '../../../domain/vocabulary'
import { APP_ID } from '../../../shared/constants/app'
import { roleKey } from '../../components/identity/RoleBadge'
import { btnOutline, btnPrimary, input } from '../../components/styles'
import type { DepartmentDirectory } from '../../features/identity/useDepartmentDirectory'

export type StatusFilter = 'all' | 'active' | 'suspended'
export interface MemberFilterValue {
  status: StatusFilter
  role: TenantRole | 'all'
  department: string
}

export default function MemberFilters({ directory, value, onApply }: { directory: DepartmentDirectory; value: MemberFilterValue; onApply: (next: MemberFilterValue) => void }) {
  const t = useT(APP_ID)
  const id = useId()
  const [status, setStatus] = useState(value.status)
  const [role, setRole] = useState(value.role)
  const [department, setDepartment] = useState(value.department)
  const field = 'flex flex-col gap-1.5 text-sm font-medium text-aura-text'

  return (
    <form
      aria-label={t('users.filters')}
      className="flex flex-1 flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        onApply({ status, role, department })
      }}
    >
      <label className={field} htmlFor={`${id}-status`}>
        {t('users.filter.status')}
        <select id={`${id}-status`} className={input} value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
          <option value="all">{t('users.filter.all')}</option>
          <option value="active">{t('users.status.active')}</option>
          <option value="suspended">{t('users.status.suspended')}</option>
        </select>
      </label>
      <label className={field} htmlFor={`${id}-role`}>
        {t('users.filter.role')}
        <select id={`${id}-role`} className={input} value={role} onChange={(e) => setRole(e.target.value as TenantRole | 'all')}>
          <option value="all">{t('users.filter.all')}</option>
          {TENANT_ROLES.map((r) => (
            <option key={r} value={r}>
              {t(roleKey(r))}
            </option>
          ))}
        </select>
      </label>
      <label className={field} htmlFor={`${id}-department`}>
        {t('users.filter.department')}
        <select id={`${id}-department`} className={input} value={department} onChange={(e) => setDepartment(e.target.value)}>
          <option value="all">{t('users.filter.all')}</option>
          {directory.departments.map((d) => (
            <option key={d.departmentId} value={d.departmentId}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      <div className="sticky bottom-0 -mx-6 mt-auto flex items-end gap-2 border-t border-aura-border bg-aura-surface px-6 pt-4">
        <button type="submit" className={btnPrimary}>
          {t('users.filter.apply')}
        </button>
        <button type="button" className={btnOutline} onClick={() => onApply({ status: 'all', role: 'all', department: 'all' })}>
          {t('users.filter.clear')}
        </button>
      </div>
    </form>
  )
}
