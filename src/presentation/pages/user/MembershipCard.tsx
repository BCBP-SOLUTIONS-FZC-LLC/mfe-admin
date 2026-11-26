// E2 membership: suspend or reactivate (P-7, never blocked, moves no work), remove (P-8, runs the
// impact review), reset MFA (P-34, needs the admin's own fresh MFA first). Each is one confirmation
// that names the person; a failure shows in place and the dialog stays open.
import { useStepUp, useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Member } from '../../../domain/entities/member'
import { planReactivation, planRemoval, planSuspension, type StatusFailure } from '../../../domain/rules/admin-rules'
import { APP_ID } from '../../../shared/constants/app'
import ConfirmDialog from '../../components/ConfirmDialog'
import ProblemDetails from '../../components/ProblemDetails'
import type { AdminAccess } from '../../features/access/useAdminAccess'
import { useRemoveMember, useResetMfa, useSetMemberStatus } from '../../features/members/useMemberDetail'
import type { Resolvable } from '../../features/members/useResolvableAction'
import { useAdminServices } from '../../features/services'
import { useProblemText } from '../../features/useProblemText'

type Dialog = 'suspend' | 'reactivate' | 'remove' | 'reset'

const STATUS_FAILURE_KEYS = {
  'last-owner': 'detail.membership.error.lastOwner',
  'not-active': 'detail.membership.error.alreadySuspended',
  'not-suspended': 'detail.membership.error.notSuspended',
} as const satisfies Record<StatusFailure, string>

export default function MembershipCard({ member, name, access, activeOwnerCount, resolvable }: { member: Member; name: string; access: AdminAccess; activeOwnerCount: number | undefined; resolvable: Resolvable }) {
  const t = useT(APP_ID)
  const problemText = useProblemText()
  const { problems, telemetry } = useAdminServices()
  const stepUp = useStepUp()
  const navigate = useNavigate()
  const suspend = useSetMemberStatus(member.userId, 'suspend')
  const reactivate = useSetMemberStatus(member.userId, 'reactivate')
  const remove = useRemoveMember(member.userId)
  const reset = useResetMfa(member.userId)

  const [dialog, setDialog] = useState<Dialog | undefined>()
  const [refusal, setRefusal] = useState<string | undefined>()
  const [error, setError] = useState<unknown>()
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | undefined>()

  // Admins and owners see the controls; a read-only workspace disables them, with the reason.
  const editable = access.hasManageMembers
  const reason = access.readOnly ? t('detail.readOnly') : undefined
  const ownerCount = activeOwnerCount ?? Number.POSITIVE_INFINITY
  const input = { member, activeOwnerCount: ownerCount }

  const close = () => {
    setDialog(undefined)
    setError(undefined)
  }

  const open = (which: Dialog) => {
    setNotice(undefined)
    const plan = which === 'suspend' ? planSuspension(input) : which === 'reactivate' ? planReactivation(input) : which === 'remove' ? planRemoval(input) : undefined
    if (plan && !plan.ok) {
      setRefusal(t(STATUS_FAILURE_KEYS[plan.failure]))
      return
    }
    setRefusal(undefined)
    setDialog(which)
  }

  const run = async (call: () => Promise<unknown>, done: () => void) => {
    setBusy(true)
    setError(undefined)
    try {
      await call()
      done()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  const confirmStatus = (status: 'active' | 'suspended') => {
    const plan = status === 'suspended' ? planSuspension(input) : planReactivation(input)
    if (!plan.ok) return setRefusal(t(STATUS_FAILURE_KEYS[plan.failure]))
    const mutation = status === 'suspended' ? suspend : reactivate
    void run(() => mutation.mutateAsync(plan.value), () => (close(), setNotice(t(status === 'suspended' ? 'detail.membership.suspended' : 'detail.membership.reactivated', { name }))))
  }

  const confirmRemove = () => {
    const plan = planRemoval(input)
    if (!plan.ok) return setRefusal(t(STATUS_FAILURE_KEYS[plan.failure]))
    setBusy(true)
    setError(undefined)
    // The impact review: IAM's 409 opens the resolution dialog (this confirmation steps aside), and
    // the removal is re-sent after the choice; either way the user lands back on the list.
    resolvable
      .run(() => remove.mutateAsync(undefined), () => navigate('/admin/users', { state: { removed: name } }))
      .then((result) => result === 'blocked' && close())
      .catch(setError)
      .finally(() => setBusy(false))
  }

  const confirmReset = async () => {
    // The gateway refuses a stale MFA with DENY_MFA_STALE: step up first when the login is older than the window.
    if (stepUp.needed) return startStepUp()
    await run(() => reset.mutateAsync(undefined), () => (close(), setNotice(t('detail.membership.resetDone'))))
  }

  const startStepUp = async () => {
    telemetry.stepUpRequested('reset_mfa')
    await stepUp.reauthenticate()
  }

  const resetFailed = dialog === 'reset' && error !== undefined
  const staleAfterCall = resetFailed && problems.isMfaStale(error)

  return (
    <section aria-labelledby="membership-title" className="flex flex-col gap-2">
      <h2 id="membership-title" className="text-lg font-semibold">
        {t('detail.membership.title')}
      </h2>
      {editable && (
        <div className="flex flex-wrap gap-2">
          {member.status === 'active' ? (
            <button type="button" className="btn btn-sm" disabled={access.readOnly} title={reason} onClick={() => open('suspend')}>
              {t('detail.membership.suspend')}
            </button>
          ) : (
            <button type="button" className="btn btn-sm" disabled={access.readOnly} title={reason} onClick={() => open('reactivate')}>
              {t('detail.membership.reactivate')}
            </button>
          )}
          <button type="button" className="btn btn-sm" disabled={access.readOnly || member.status !== 'active'} title={reason} onClick={() => open('reset')}>
            {t('detail.membership.resetMfa')}
          </button>
          <button type="button" className="btn btn-error btn-sm" disabled={access.readOnly} title={reason} onClick={() => open('remove')}>
            {t('detail.membership.remove')}
          </button>
        </div>
      )}
      {refusal && (
        <p role="alert" className="text-error">
          {refusal}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}

      {dialog === 'suspend' && (
        <ConfirmDialog title={t('detail.membership.suspendTitle', { name })} confirmLabel={t('detail.membership.suspend')} busy={busy} error={error} onCancel={close} onConfirm={() => confirmStatus('suspended')}>
          <p>{t('detail.membership.suspendBody')}</p>
        </ConfirmDialog>
      )}
      {dialog === 'reactivate' && (
        <ConfirmDialog title={t('detail.membership.reactivateTitle', { name })} confirmLabel={t('detail.membership.reactivate')} busy={busy} error={error} onCancel={close} onConfirm={() => confirmStatus('active')}>
          <p>{t('detail.membership.reactivateBody')}</p>
        </ConfirmDialog>
      )}
      {dialog === 'remove' && !resolvable.resolution.open && (
        <ConfirmDialog title={t('detail.membership.removeTitle', { name })} confirmLabel={t('detail.membership.remove')} danger busy={busy} error={error} onCancel={close} onConfirm={confirmRemove}>
          <p>{t('detail.membership.removeBody', { name })}</p>
          <p className="text-sm text-base-content/70">{t('detail.impactNotChecked')}</p>
        </ConfirmDialog>
      )}
      {dialog === 'reset' && (
        <ConfirmDialog
          title={t('detail.membership.resetTitle', { name })}
          confirmLabel={stepUp.needed ? t('detail.stepUp.button') : t('detail.membership.resetMfa')}
          busy={busy}
          onCancel={close}
          onConfirm={() => void confirmReset()}
        >
          <p>{t('detail.membership.resetBody')}</p>
          {stepUp.needed && (
            <p role="status" className="text-sm">
              {t('detail.stepUp.body')}
            </p>
          )}
          {resetFailed && !staleAfterCall && (
            <div role="alert" className="flex flex-wrap items-center gap-2 text-error">
              <span>
                {t('detail.membership.resetFailed')} {problemText(error)}
              </span>
              <ProblemDetails error={error} />
            </div>
          )}
          {staleAfterCall && (
            <div role="alert" className="flex flex-col gap-2 text-error">
              <span>{problemText(error)}</span>
              <button type="button" className="btn btn-sm self-start" onClick={() => void startStepUp()}>
                {t('detail.stepUp.button')}
              </button>
            </div>
          )}
        </ConfirmDialog>
      )}
    </section>
  )
}
