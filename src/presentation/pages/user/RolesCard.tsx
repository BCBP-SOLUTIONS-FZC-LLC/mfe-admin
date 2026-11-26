// E2 tenant roles (P-28, full replacement). Owner and admin roles are an owner's to grant or remove
// (HLD §6.4; IAM-FE-Q14: the UI follows the HLD, the service accepts more). The last owner stays.
import { useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { useCurrentUser } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { useMemo, useState } from 'react'
import type { Member } from '../../../domain/entities/member'
import { planRoleChange, type RoleChangeFailure } from '../../../domain/rules/admin-rules'
import { ADMIN, OWNER, TENANT_ROLES, type TenantRole } from '../../../domain/vocabulary'
import { APP_ID } from '../../../shared/constants/app'
import ProblemDetails from '../../components/ProblemDetails'
import { roleKey } from '../../components/identity/RoleBadge'
import type { AdminAccess } from '../../features/access/useAdminAccess'
import { useSetRoles } from '../../features/members/useMemberDetail'
import { useSessionRefresh } from '../../features/session/useSessionRefresh'
import { useProblemText } from '../../features/useProblemText'

const FAILURE_KEYS = {
  'member-role': 'detail.roles.error.member',
  'invalid-role': 'detail.roles.error.invalid',
  'role-not-offered': 'detail.roles.error.notOffered',
  'last-owner': 'detail.roles.error.lastOwner',
} as const satisfies Record<RoleChangeFailure, string>

export default function RolesCard({ member, access, ownerCount, saved, onSaved, onEdit }: { member: Member; access: AdminAccess; ownerCount: number | undefined; saved: boolean; onSaved: () => void; onEdit: () => void }) {
  const t = useT(APP_ID)
  const problemText = useProblemText()
  const me = useCurrentUser()
  const refreshSession = useSessionRefresh()
  const setRoles = useSetRoles(member.userId)
  const initial = useMemo(() => new Set(member.tenantRoles), [member.tenantRoles])
  const [roles, setRoles_] = useState<ReadonlySet<TenantRole>>(initial)
  const [invalid, setInvalid] = useState<RoleChangeFailure | undefined>()

  const editable = access.canManageMembers
  const changed = roles.size !== initial.size || [...roles].some((r) => !initial.has(r))
  const ownerOnly = (role: TenantRole) => role === OWNER || role === ADMIN

  const toggle = (role: TenantRole) => {
    onEdit()
    setRoles_((current) => {
      const next = new Set(current)
      if (!next.delete(role)) next.add(role)
      return next
    })
  }

  const save = async () => {
    const plan = planRoleChange({ current: member.tenantRoles, next: [...roles], actorIsOwner: access.canManageAdminRoles, ownerCount: ownerCount ?? Number.POSITIVE_INFINITY })
    if (!plan.ok) {
      setInvalid(plan.failure)
      return
    }
    setInvalid(undefined)
    const { roles: wanted } = plan.value // the planned list, not a read of the session's roles
    await setRoles.mutateAsync(wanted).then(
      () => {
        onSaved()
        // Changing your own roles changes what you may see: ask for fresh permission hints.
        if (me?.sub === member.userId) void refreshSession()
      },
      () => {},
    )
  }

  return (
    <section aria-labelledby="roles-title" className="flex flex-col gap-2">
      <h2 id="roles-title" className="text-lg font-semibold">
        {t('detail.roles.title')}
      </h2>
      <p className="text-sm text-base-content/70">{t('detail.roles.hint')}</p>
      {TENANT_ROLES.map((role) => (
        <label key={role} className="flex items-center gap-2">
          <input type="checkbox" className="checkbox checkbox-sm" checked={roles.has(role)} disabled={!editable || (ownerOnly(role) && !access.canManageAdminRoles)} onChange={() => toggle(role)} />
          {t(roleKey(role))}
        </label>
      ))}
      {invalid && (
        <p role="alert" className="text-error">
          {t(FAILURE_KEYS[invalid])}
        </p>
      )}
      {setRoles.isError && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-error">
          <span>{problemText(setRoles.error)}</span>
          <ProblemDetails error={setRoles.error} />
        </div>
      )}
      {saved && <p role="status">{t('detail.roles.saved')}</p>}
      {editable && (
        <button type="button" className="btn btn-primary btn-sm self-start" disabled={!changed || setRoles.isPending} onClick={() => void save()}>
          {t('detail.roles.save')}
        </button>
      )}
    </section>
  )
}
