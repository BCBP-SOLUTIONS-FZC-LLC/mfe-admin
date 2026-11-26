// E1's pending invitations (P-30): who was invited, by whom, when it expires, and Revoke (P-31),
// which needs the invitation's version and frees the seat. A lost lock race (409) offers Reload.
import { formatDate } from '@bcbp-solutions-fzc-llc/frontend-sdk/i18n'
import { useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { useMemo, useState } from 'react'
import type { Invitation } from '../../../domain/entities/invitation'
import { APP_ID } from '../../../shared/constants/app'
import ConflictDialog from '../../components/ConflictDialog'
import Dialog from '../../components/Dialog'
import LoadFailed from '../../components/LoadFailed'
import ProblemDetails from '../../components/ProblemDetails'
import RoleBadge from '../../components/identity/RoleBadge'
import UserChip from '../../components/identity/UserChip'
import { btnDanger, btnOutline, table, tableWrap, td, tdMessage, th, tr } from '../../components/styles'
import Avatar from '../../components/identity/Avatar'
import { useUserProfiles } from '../../features/identity/useUserProfiles'
import { useInvitations, useRevokeInvitation } from '../../features/members/useMembers'
import { useAdminServices } from '../../features/services'
import { useProblemText } from '../../features/useProblemText'

export default function InvitationsTab({ canRevoke, readOnly }: { canRevoke: boolean; readOnly: boolean }) {
  const t = useT(APP_ID)
  const problemText = useProblemText()
  const { problems } = useAdminServices()
  const list = useInvitations(true)
  const invitations = useMemo(() => list.data ?? [], [list.data])
  const profiles = useUserProfiles(useMemo(() => invitations.map((i) => i.invitedBy), [invitations]))
  const revoke = useRevokeInvitation()
  const [target, setTarget] = useState<Invitation | undefined>()
  const [done, setDone] = useState(false)

  if (list.isError) return <LoadFailed message={t('users.inv.failed')} error={list.error} onRetry={() => void list.refetch()} />

  const close = () => {
    setTarget(undefined)
    revoke.reset()
  }

  return (
    <div className="flex flex-col gap-3">
      {done && (
        <p role="status" className="rounded-lg bg-emerald-500/12 px-4 py-2 text-sm text-emerald-800 dark:text-emerald-200">
          {t('users.inv.revoked')}
        </p>
      )}
      <div className={tableWrap}>
        <table className={table} aria-busy={list.isFetching}>
          <thead>
            <tr>
              <th className={th}>{t('users.inv.email')}</th>
              <th className={th}>{t('users.inv.name')}</th>
              <th className={th}>{t('users.inv.roles')}</th>
              <th className={th}>{t('users.inv.invitedBy')}</th>
              <th className={th}>{t('users.inv.sent')}</th>
              <th className={th}>{t('users.inv.expires')}</th>
              <th className={th}>
                <span className="sr-only">{t('common.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.isPending && (
              <tr className={tr}>
                <td colSpan={7} className={tdMessage}>{t('common.loading')}</td>
              </tr>
            )}
            {!list.isPending && invitations.length === 0 && (
              <tr className={tr}>
                <td colSpan={7} className={tdMessage}>{t('users.inv.empty')}</td>
              </tr>
            )}
            {invitations.map((inv) => (
              <tr key={inv.invitationId} className={tr}>
                <td className={td}>
                  <span className="flex items-center gap-3">
                    <Avatar name={inv.fullName || inv.email} />
                    <span className="whitespace-nowrap font-medium text-aura-text">{inv.email}</span>
                  </span>
                </td>
                <td className={`${td} whitespace-nowrap`}>{inv.fullName}</td>
                <td className={td}>
                  <div className="flex flex-wrap gap-1">
                    {inv.initialRoles.map((r) => (
                      <RoleBadge key={r} role={r} />
                    ))}
                  </div>
                </td>
                <td className={td}>
                  <UserChip profile={profiles.of(inv.invitedBy)} showTitle={false} />
                </td>
                <td className={`${td} text-aura-muted`}>{formatDate(inv.sentAt)}</td>
                <td className={`${td} text-aura-muted`}>{formatDate(inv.expiresAt)}</td>
                <td className={td}>
                  {canRevoke && (
                    <button type="button" className={btnOutline} disabled={readOnly} title={readOnly ? t('users.readOnly') : undefined} onClick={() => (setDone(false), setTarget(inv))}>
                      {t('users.inv.revoke')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {target && revoke.isError && problems.isConflict(revoke.error) && (
        <ConflictDialog
          onClose={close}
          onReload={() => {
            close()
            void list.refetch()
          }}
        />
      )}
      {target && !(revoke.isError && problems.isConflict(revoke.error)) && (
        <Dialog title={t('users.inv.revokeTitle')} onClose={close}>
          <p className="mb-4 text-sm text-aura-muted">{t('users.inv.revokeBody', { email: target.email })}</p>
          {revoke.isError && (
            <div role="alert" className="mb-4 flex flex-wrap items-center gap-2 text-sm text-red-600">
              <span>{problemText(revoke.error)}</span>
              <ProblemDetails error={revoke.error} />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className={btnOutline} onClick={close}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className={btnDanger}
              disabled={revoke.isPending}
              onClick={() => revoke.mutate({ invitationId: target.invitationId, recordVersion: target.recordVersion }, { onSuccess: () => (close(), setDone(true)) })}
            >
              {t('users.inv.revokeConfirm')}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  )
}
