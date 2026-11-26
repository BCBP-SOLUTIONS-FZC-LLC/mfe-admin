// E3's departments: the ones the tenant has activated (P-3, with their member counts from P-9, asked
// per row), with Retire and Reactivate (P-25, with the version being replaced). System departments
// cannot be retired, so the action is not offered for them.
import { useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { useState } from 'react'
import type { TenantDepartment } from '../../../domain/entities/department'
import { APP_ID } from '../../../shared/constants/app'
import ConfirmDialog from '../../components/ConfirmDialog'
import { Pill } from '../../components/identity/MemberBadges'
import { btnOutline, table, tableWrap, td, tdMessage, th, tr } from '../../components/styles'
import ConflictDialog from '../../components/ConflictDialog'
import LoadFailed from '../../components/LoadFailed'
import type { AdminAccess } from '../../features/access/useAdminAccess'
import { useReactivateDepartment, useRetireDepartment, useTenantDepartments } from '../../features/departments/useDepartments'
import { useDepartmentMembers } from '../../features/members/useDepartmentMembers'
import { useAdminServices } from '../../features/services'

function MemberCount({ departmentId }: { departmentId: string }) {
  const t = useT(APP_ID)
  const members = useDepartmentMembers(departmentId)
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-aura-text">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 text-aura-muted" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
      {members.isError ? t('departments.members.failed') : members.data ? members.data.length : t('departments.members.loading')}
    </span>
  )
}

export default function TenantDepartments({ access }: { access: AdminAccess }) {
  const t = useT(APP_ID)
  const { problems } = useAdminServices()
  const list = useTenantDepartments()
  const retire = useRetireDepartment()
  const reactivate = useReactivateDepartment()
  const [target, setTarget] = useState<{ department: TenantDepartment; to: 'retire' | 'reactivate' } | undefined>()
  const [notice, setNotice] = useState<string | undefined>()

  if (list.isError) return <LoadFailed message={t('departments.failed')} error={list.error} onRetry={() => void list.refetch()} />
  const mutation = target?.to === 'retire' ? retire : reactivate
  const conflict = target && mutation.isError && problems.isConflict(mutation.error)
  const close = () => {
    setTarget(undefined)
    retire.reset()
    reactivate.reset()
  }
  const departments = list.data ?? []

  return (
    <section aria-labelledby="yours-title" className="flex flex-col gap-3">
      <h2 id="yours-title" className="text-lg font-semibold text-aura-text">
        {t('departments.yours')}
      </h2>
      {notice && <p role="status" className="rounded-lg bg-emerald-500/12 px-4 py-2 text-sm text-emerald-800 dark:text-emerald-200">{notice}</p>}
      <div className={tableWrap}>
        <table className={table} aria-busy={list.isFetching}>
          <thead>
            <tr>
              <th className={th}>{t('departments.col.name')}</th>
              <th className={th}>{t('departments.col.code')}</th>
              <th className={th}>{t('departments.col.status')}</th>
              <th className={th}>{t('departments.col.members')}</th>
              <th className={th}>
                <span className="sr-only">{t('common.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.isPending && (
              <tr className={tr}>
                <td colSpan={5} className={tdMessage}>{t('departments.loading')}</td>
              </tr>
            )}
            {!list.isPending && departments.length === 0 && (
              <tr className={tr}>
                <td colSpan={5} className={tdMessage}>{t('departments.empty')}</td>
              </tr>
            )}
            {departments.map((d) => (
              <tr key={d.departmentId} className={tr}>
                <td className={`${td} font-medium text-aura-text`}>
                  {d.name} {d.isSystem && <span className="ms-1 rounded-md bg-aura-secondary-soft px-2 py-0.5 text-xs font-medium text-[color:var(--aura-secondary-on-soft)]">{t('departments.system')}</span>}
                </td>
                <td className={`${td} text-aura-muted`}>{d.code}</td>
                <td className={td}>
                  <Pill tone={d.isActive ? 'success' : 'warning'}>{t(d.isActive ? 'departments.status.active' : 'departments.status.retired')}</Pill>
                </td>
                <td className={td}>
                  <MemberCount departmentId={d.departmentId} />
                </td>
                <td className={`${td} text-end`}>
                  {access.hasManageMembers && d.isActive && !d.isSystem && (
                    <button type="button" className={btnOutline} disabled={access.readOnly} title={access.readOnly ? t('departments.readOnly') : undefined} onClick={() => (setNotice(undefined), setTarget({ department: d, to: 'retire' }))}>
                      {t('departments.retire')}
                    </button>
                  )}
                  {access.hasManageMembers && !d.isActive && (
                    <button type="button" className={btnOutline} disabled={access.readOnly} title={access.readOnly ? t('departments.readOnly') : undefined} onClick={() => (setNotice(undefined), setTarget({ department: d, to: 'reactivate' }))}>
                      {t('departments.reactivate')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {target && conflict && (
        <ConflictDialog
          onClose={close}
          onReload={() => {
            close()
            void list.refetch()
          }}
        />
      )}
      {target && !conflict && (
        <ConfirmDialog
          title={t(target.to === 'retire' ? 'departments.retireTitle' : 'departments.reactivateTitle', { name: target.department.name })}
          confirmLabel={t(target.to === 'retire' ? 'departments.confirmRetire' : 'departments.confirmReactivate')}
          danger={target.to === 'retire'}
          busy={mutation.isPending}
          error={mutation.isError ? mutation.error : undefined}
          onCancel={close}
          onConfirm={() =>
            mutation.mutate(
              { departmentId: target.department.departmentId, recordVersion: target.department.recordVersion },
              { onSuccess: () => (close(), setNotice(t(target.to === 'retire' ? 'departments.retired' : 'departments.reactivated', { name: target.department.name }))) },
            )
          }
        >
          <p>{t(target.to === 'retire' ? 'departments.retireBody' : 'departments.reactivateBody', { name: target.department.name })}</p>
        </ConfirmDialog>
      )}
    </section>
  )
}
