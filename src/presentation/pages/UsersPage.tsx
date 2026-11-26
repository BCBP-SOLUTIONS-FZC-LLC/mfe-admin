// E1 Users and invitations: seat meter, the member table, pending invitations, and the invite
// dialog. Everyone with read:members sees the list; the actions need manage:members and a
// read-write workspace (disabled with the reason when it is read-only). A plain member does not
// ask for seats or invitations: P-27 and P-30 are for admins and owners.
import { useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { seatState } from '../../domain/rules/admin-rules'
import { APP_ID } from '../../shared/constants/app'
import LoadFailed from '../components/LoadFailed'
import SeatMeter from '../components/SeatMeter'
import { btnPrimary } from '../components/styles'
import { useAdminAccess } from '../features/access/useAdminAccess'
import { useDepartmentDirectory } from '../features/identity/useDepartmentDirectory'
import { useSeatUsage } from '../features/members/useMembers'
import { useAdminServices } from '../features/services'
import InvitationsTab from './users/InvitationsTab'
import InviteDialog from './users/InviteDialog'
import MembersTab from './users/MembersTab'
import UpgradePrompt from './users/UpgradePrompt'

type Tab = 'members' | 'invitations'

export default function UsersPage() {
  const t = useT(APP_ID)
  const access = useAdminAccess()
  const { navigation } = useAdminServices()
  const directory = useDepartmentDirectory()
  const seats = useSeatUsage(access.hasManageMembers)
  const removed = (useLocation().state as { removed?: string } | null)?.removed
  const [tab, setTab] = useState<Tab>('members')
  const [dialog, setDialog] = useState<'invite' | 'upgrade' | undefined>()

  const startInvite = () => {
    // The seat meter comes before the form: a full workspace gets the upgrade prompt instead.
    setDialog(seats.data && seatState(seats.data) !== 'room' ? 'upgrade' : 'invite')
  }

  const tabClass = (active: boolean) =>
    `inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
      active ? 'bg-aura-primary-soft text-[color:var(--aura-primary-on-soft)]' : 'text-aura-muted hover:bg-aura-hover hover:text-aura-text'
    }`
  const count = (n: number | undefined) =>
    n === undefined ? null : (
      <span aria-hidden="true" className="rounded-full bg-aura-surface px-2 py-0.5 text-xs font-semibold text-aura-text ring-1 ring-aura-border">
        {n}
      </span>
    )

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-aura-text">{t('users.title')}</h1>
          <p className="mt-1 text-sm text-aura-muted">{t('users.subtitle')}</p>
        </div>
        {access.hasManageMembers && (
          <button type="button" className={btnPrimary} disabled={access.readOnly || !seats.data} title={access.readOnly ? t('users.readOnly') : undefined} onClick={startInvite}>
            {t('users.invite')}
          </button>
        )}
      </div>

      {removed && <p role="status" className="rounded-lg bg-aura-secondary-soft px-4 py-2 text-sm text-aura-text">{t('detail.removed', { name: removed })}</p>}
      {access.hasManageMembers && seats.data && <SeatMeter usage={seats.data} onUpgrade={access.canManageMembers ? navigation.upgrade : undefined} />}
      {access.hasManageMembers && seats.isError && <LoadFailed message={t('users.seats.failed')} error={seats.error} onRetry={() => void seats.refetch()} />}

      {access.hasManageMembers && (
        <div role="tablist" className="flex w-fit gap-1 rounded-full bg-aura-canvas p-1 ring-1 ring-aura-border">
          <button role="tab" type="button" aria-selected={tab === 'members'} className={tabClass(tab === 'members')} onClick={() => setTab('members')}>
            {t('users.tab.members')}
            {count(seats.data?.activeUsers)}
          </button>
          <button role="tab" type="button" aria-selected={tab === 'invitations'} className={tabClass(tab === 'invitations')} onClick={() => setTab('invitations')}>
            {t('users.tab.invitations')}
            {count(seats.data?.pendingInvitations)}
          </button>
        </div>
      )}

      {tab === 'members' || !access.hasManageMembers ? <MembersTab directory={directory} /> : <InvitationsTab canRevoke={access.hasManageMembers} readOnly={access.readOnly} />}

      {dialog === 'invite' && seats.data && <InviteDialog seats={seats.data} directory={directory} actorIsOwner={access.canManageAdminRoles} onClose={() => setDialog(undefined)} />}
      {dialog === 'upgrade' && seats.data && <UpgradePrompt licensed={seats.data.licensedSeats} onUpgrade={navigation.upgrade} onClose={() => setDialog(undefined)} />}
    </section>
  )
}
