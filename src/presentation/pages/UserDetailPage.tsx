// E2 User detail: who this member is, their roles, departments and membership, with the changes an
// admin may make. The page is readable by every member (P-5); the controls need manage:members and a
// read-write workspace. Removing or demoting someone who covers work for others asks what to do with
// it first (E2a step 2).
import { useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { OWNER } from '../../domain/vocabulary'
import { APP_ID } from '../../shared/constants/app'
import LoadFailed from '../components/LoadFailed'
import ResolutionDialog from '../components/ResolutionDialog'
import RoleBadge from '../components/identity/RoleBadge'
import UserChip from '../components/identity/UserChip'
import { useAdminAccess } from '../features/access/useAdminAccess'
import { useDepartmentDirectory } from '../features/identity/useDepartmentDirectory'
import { useActiveOwnerCount, useMemberDetail, useUserDetail } from '../features/members/useMemberDetail'
import { useResolvableAction } from '../features/members/useResolvableAction'
import DepartmentsCard from './user/DepartmentsCard'
import MembershipCard from './user/MembershipCard'
import ProfileCard from './user/ProfileCard'
import RolesCard from './user/RolesCard'

const AVAILABILITY_KEYS = { available: 'detail.availability.available', busy: 'detail.availability.busy', ooo: 'detail.availability.ooo' } as const

export default function UserDetailPage() {
  const t = useT(APP_ID)
  const { userId = '' } = useParams()
  const access = useAdminAccess()
  const directory = useDepartmentDirectory()
  const member = useMemberDetail(userId)
  const user = useUserDetail(userId)
  const resolvable = useResolvableAction(userId)
  // The "saved" notices live here: a save changes the record's version, which reloads the card's form (keyed by the version), and a notice kept inside the card would be lost with it.
  const [saved, setSaved] = useState<'profile' | 'roles' | undefined>()

  const isActiveOwner = member.data?.status === 'active' && member.data.tenantRoles.includes(OWNER)
  const owners = useActiveOwnerCount(isActiveOwner)
  const profile = useMemo(() => (user.data ? ({ state: 'found', user: user.data } as const) : user.isError ? ({ state: 'unavailable' } as const) : undefined), [user.data, user.isError])
  const name = user.data?.displayName ?? t('detail.noName')

  const back = (
    <Link to="/admin/users" className="link">
      {t('detail.back')}
    </Link>
  )

  if (member.isError) {
    return (
      <section className="flex flex-col gap-3">
        {back}
        <LoadFailed message={t('detail.failed')} error={member.error} onRetry={() => void member.refetch()} />
      </section>
    )
  }
  if (member.isPending) {
    return (
      <section className="flex flex-col gap-3" aria-busy="true">
        {back}
        <p>{t('detail.loading')}</p>
      </section>
    )
  }

  const m = member.data
  const status = user.data?.status === 'disabled' ? 'detail.status.disabled' : m.status === 'suspended' ? 'detail.status.suspended' : 'detail.status.active'

  return (
    <section className="flex flex-col gap-6">
      {back}
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">{name}</h1>
        <UserChip profile={profile} />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="badge">{t(status)}</span>
          {user.data && <span className="badge badge-outline">{t(user.data.source === 'federated' ? 'detail.signIn.federated' : 'detail.signIn.local')}</span>}
          {user.data?.availability && <span className="badge badge-outline">{t(AVAILABILITY_KEYS[user.data.availability])}</span>}
          {m.tenantRoles.map((r) => (
            <RoleBadge key={r} role={r} />
          ))}
        </div>
        {user.isError && <LoadFailed message={t('detail.failed')} error={user.error} onRetry={() => void user.refetch()} />}
        {access.readOnly && <p role="status">{t('detail.readOnly')}</p>}
        {isActiveOwner && owners.isError && <p role="status">{t('detail.ownerCountUnknown')}</p>}
      </div>

      {user.data && <ProfileCard key={user.data.recordVersion} user={user.data} access={access} saved={saved === 'profile'} onSaved={() => setSaved('profile')} onEdit={() => setSaved(undefined)} onReload={() => void user.refetch()} />}
      <RolesCard key={m.recordVersion} member={m} access={access} ownerCount={owners.data} saved={saved === 'roles'} onSaved={() => setSaved('roles')} onEdit={() => setSaved(undefined)} />
      <DepartmentsCard member={m} name={name} access={access} directory={directory} resolvable={resolvable} />
      <MembershipCard member={m} name={name} access={access} activeOwnerCount={owners.data} resolvable={resolvable} />
      <ResolutionDialog state={resolvable.resolution} subjectUserId={userId} subjectName={name} />
    </section>
  )
}
