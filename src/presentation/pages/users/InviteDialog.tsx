// E1a: invite a user (P-6). The form is validated by planInvitation before anything is sent; the
// service re-checks everything (seat cap, duplicate, rate limit) and its answer is shown in plain
// words. A 503 means nothing was sent, and the dialog says so (IAM-UX-5).
import { formatDate } from '@bcbp-solutions-fzc-llc/frontend-sdk/i18n'
import { useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { useId, useState, type FormEvent } from 'react'
import type { Invitation } from '../../../domain/entities/invitation'
import type { SeatUsage } from '../../../domain/entities/seats'
import { planInvitation, type InvitationFailure } from '../../../domain/rules/admin-rules'
import { DEPARTMENT_LEVELS, TENANT_ROLES, TENDER_ADMIN, type DepartmentLevel, type TenantRole } from '../../../domain/vocabulary'
import { APP_ID } from '../../../shared/constants/app'
import Dialog from '../../components/Dialog'
import ProblemDetails from '../../components/ProblemDetails'
import { roleKey } from '../../components/identity/RoleBadge'
import { btnOutline, btnPrimary, input } from '../../components/styles'
import { seatsUsed } from '../../../domain/rules/admin-rules'
import { useLevelText } from '../../components/identity/DepartmentLabel'
import type { DepartmentDirectory } from '../../features/identity/useDepartmentDirectory'
import { useInviteMember } from '../../features/members/useMembers'
import { useProblemText } from '../../features/useProblemText'

const FAILURE_KEYS = {
  'email-invalid': 'invite.error.email',
  'name-required': 'invite.error.name',
  'name-too-long': 'invite.error.nameLong',
  'seats-full': 'invite.error.seats',
  'role-not-offered': 'invite.error.role',
  'department-inactive': 'invite.error.department',
} as const satisfies Record<InvitationFailure, string>

const ROLE_HINT_KEYS = {
  tenant_owner: 'invite.roleOwnerHint',
  tenant_admin: 'invite.roleAdminHint',
  tender_admin: 'invite.roleTenderHint',
} as const satisfies Record<TenantRole, string>

interface Row {
  departmentId: string
  level: DepartmentLevel
}

export default function InviteDialog({
  seats,
  directory,
  actorIsOwner,
  onClose,
}: {
  seats: SeatUsage
  directory: DepartmentDirectory
  actorIsOwner: boolean
  onClose: () => void
}) {
  const t = useT(APP_ID)
  const problemText = useProblemText()
  const levelText = useLevelText(directory)
  const invite = useInviteMember()
  const id = useId()

  const active = directory.departments.filter((d) => d.isActive)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [roles, setRoles] = useState<ReadonlySet<TenantRole>>(new Set())
  const [rows, setRows] = useState<Row[]>([])
  const [invalid, setInvalid] = useState<{ failure: InvitationFailure; at?: string } | undefined>()
  const [sent, setSent] = useState<Invitation | undefined>()

  // Owners and admins invite tender admins; only an owner offers owner and admin (IAM-FE-Q14).
  const offered = TENANT_ROLES.filter((r) => actorIsOwner || r === TENDER_ADMIN)

  const toggle = (role: TenantRole) =>
    setRoles((current) => {
      const next = new Set(current)
      if (!next.delete(role)) next.add(role)
      return next
    })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const plan = planInvitation({
      email,
      fullName,
      tenantRoles: [...roles],
      departments: rows,
      seats,
      actorIsOwner,
      activeDepartmentIds: new Set(active.map((d) => d.departmentId)),
    })
    if (!plan.ok) {
      setInvalid({ failure: plan.failure, ...(plan.at ? { at: plan.at } : {}) })
      return
    }
    setInvalid(undefined)
    invite.mutate(plan.value, { onSuccess: setSent })
  }

  if (sent) {
    return (
      <Dialog title={t('invite.title')} onClose={onClose}>
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-full bg-emerald-500/15 text-2xl text-emerald-700 dark:text-emerald-300">
            ✓
          </span>
          <p role="status" className="max-w-sm text-sm text-aura-text">
            {t('invite.sent', { email: sent.email, date: formatDate(sent.expiresAt) })}
          </p>
        </div>
        <div className="flex justify-end">
          <button type="button" className={btnPrimary} onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </Dialog>
    )
  }

  return (
    <Dialog title={t('invite.title')} subtitle={t('invite.subtitle')} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <p className="rounded-lg bg-aura-primary-soft px-3 py-2 text-sm font-medium text-[color:var(--aura-primary-on-soft)]">
          {t('invite.seatsFree', { count: Math.max(seats.licensedSeats - seatsUsed(seats), 0) })}
        </p>
        <label className="flex flex-col gap-1 text-sm font-medium" htmlFor={`${id}-email`}>
          <span>{t('invite.email')}</span>
          <input id={`${id}-email`} type="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={invalid?.failure === 'email-invalid'} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium" htmlFor={`${id}-name`}>
          <span>{t('invite.name')}</span>
          <input id={`${id}-name`} className={input} value={fullName} onChange={(e) => setFullName(e.target.value)} aria-invalid={invalid?.failure === 'name-required' || invalid?.failure === 'name-too-long'} />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">{t('invite.roles')}</legend>
          <p className="text-xs text-aura-muted">{t('invite.rolesHint')}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {offered.map((role) => (
              <label
                key={role}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                  roles.has(role) ? 'border-aura-primary bg-aura-primary-soft' : 'border-aura-border bg-aura-canvas hover:bg-aura-hover'
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-[var(--aura-primary)]"
                  aria-labelledby={`${id}-${role}`}
                  aria-describedby={`${id}-${role}-hint`}
                  checked={roles.has(role)}
                  onChange={() => toggle(role)}
                />
                <span className="flex flex-col">
                  <span id={`${id}-${role}`} className="text-sm font-medium text-aura-text">{t(roleKey(role))}</span>
                  <span id={`${id}-${role}-hint`} className="text-xs text-aura-muted">{t(ROLE_HINT_KEYS[role])}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">{t('invite.departments')}</legend>
          {active.length === 0 && <p className="text-xs text-aura-muted">{t('invite.noDepartments')}</p>}
          {rows.map((row, index) => (
            <div key={index} className="flex flex-wrap items-center gap-2 rounded-xl border border-aura-border bg-aura-canvas p-2">
              <select
                aria-label={t('invite.department')}
                className={`${input} min-w-40 flex-1`}
                value={row.departmentId}
                onChange={(e) => setRows((rs) => rs.map((r, i) => (i === index ? { ...r, departmentId: e.target.value } : r)))}
              >
                {active.map((d) => (
                  <option key={d.departmentId} value={d.departmentId}>
                    {d.name}
                  </option>
                ))}
              </select>
              <select
                aria-label={t('invite.level')}
                className={`${input} min-w-32 flex-1`}
                value={row.level}
                onChange={(e) => setRows((rs) => rs.map((r, i) => (i === index ? { ...r, level: e.target.value as DepartmentLevel } : r)))}
              >
                {DEPARTMENT_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {levelText(level)}
                  </option>
                ))}
              </select>
              <button type="button" className={btnOutline} onClick={() => setRows((rs) => rs.filter((_, i) => i !== index))}>
                {t('invite.removeDepartment')}
              </button>
            </div>
          ))}
          <button type="button" className={`${btnOutline} self-start`} disabled={active.length === 0} onClick={() => setRows((rs) => [...rs, { departmentId: active[0]!.departmentId, level: DEPARTMENT_LEVELS[0] }])}>
            {t('invite.addDepartment')}
          </button>
        </fieldset>

        {invalid && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {t(FAILURE_KEYS[invalid.failure])}
          </p>
        )}
        {invite.isError && (
          <div role="alert" className="flex flex-wrap items-center gap-2 text-sm font-medium text-red-600">
            <span>{problemText(invite.error)}</span>
            <ProblemDetails error={invite.error} />
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-aura-border pt-4">
          <button type="button" className={btnOutline} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className={btnPrimary} disabled={invite.isPending}>
            {invite.isPending ? t('invite.sending') : t('invite.send')}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
