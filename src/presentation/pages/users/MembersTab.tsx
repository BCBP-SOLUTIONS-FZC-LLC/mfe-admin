// E1's member table: P-4 (IDs only) joined with User Profile (IAM-UX-4), paged by cursor. There is no
// server-side search or filter (IAM-FE-Q5): status and role are filtered over the pages loaded so far
// and the screen says so; the department filter uses P-9. MFA and last-login columns are omitted
// (IAM-FE-Q4): no IAM read returns them.
import { useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Member, ProfileState } from '../../../domain/entities/member'
import { type TenantRole } from '../../../domain/vocabulary'
import { APP_ID } from '../../../shared/constants/app'
import LoadFailed from '../../components/LoadFailed'
import { AvailabilityDot, SignInBadge, StatusPill, type StatusKind } from '../../components/identity/MemberBadges'
import FilterDrawer from '../../components/FilterDrawer'
import { btnOutline, card, cardHeader, cardTitle, input, table, td, tdMessage, th, tr } from '../../components/styles'
import DepartmentLabel from '../../components/identity/DepartmentLabel'
import RoleBadge from '../../components/identity/RoleBadge'
import UserChip from '../../components/identity/UserChip'
import type { DepartmentDirectory } from '../../features/identity/useDepartmentDirectory'
import { useUserProfiles } from '../../features/identity/useUserProfiles'
import { useDepartmentMembers } from '../../features/members/useDepartmentMembers'
import { useMemberList } from '../../features/members/useMembers'
import MemberFilters, { type StatusFilter } from './MemberFilters'

/** What the status column says: the membership's status, or that sign-in is disabled (User Profile). */
function statusOf(member: Member, profile: ProfileState | undefined): StatusKind {
  if (profile?.state === 'found' && profile.user.status === 'disabled') return 'disabled'
  return member.status === 'suspended' ? 'suspended' : 'active'
}

export default function MembersTab({ directory }: { directory: DepartmentDirectory }) {
  const t = useT(APP_ID)
  const list = useMemberList()
  const members = useMemo(() => list.data?.pages.flatMap((p) => p.members) ?? [], [list.data])
  const profiles = useUserProfiles(useMemo(() => members.map((m) => m.userId), [members]))

  const [status, setStatus] = useState<StatusFilter>('all')
  const [role, setRole] = useState<TenantRole | 'all'>('all')
  const [department, setDepartment] = useState('all')
  const [query, setQuery] = useState('')
  const inDepartment = useDepartmentMembers(department === 'all' ? undefined : department)

  const needle = query.trim().toLowerCase()
  const filtered = status !== 'all' || role !== 'all' || department !== 'all' || needle !== ''
  const visible = members.filter((m) => {
    if (status !== 'all' && m.status !== status) return false
    if (role !== 'all' && !m.tenantRoles.includes(role)) return false
    if (department !== 'all' && !(inDepartment.data ?? []).some((d) => d.userId === m.userId)) return false
    if (needle) {
      // Search is over the members loaded so far (no server-side search, IAM-FE-Q5): name and email.
      const p = profiles.of(m.userId)
      if (p?.state !== 'found' || !`${p.user.displayName} ${p.user.email}`.toLowerCase().includes(needle)) return false
    }
    return true
  })

  if (list.isError) return <LoadFailed message={t('users.failed')} error={list.error} onRetry={() => void list.refetch()} />

  return (
    <div className="flex flex-col gap-3">
      {department !== 'all' && inDepartment.isError && (
        <p role="alert" className="text-sm text-red-600">
          {t('users.filter.departmentFailed')}
        </p>
      )}

      <div className={`${card} overflow-hidden`}>
        <div className={cardHeader}>
          <h2 className={cardTitle}>{t('users.list.title')}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <label className="w-60 max-w-full">
              <span className="sr-only">{t('users.search')}</span>
              <input type="search" className={`${input} !py-1.5`} placeholder={t('users.search.placeholder')} value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <FilterDrawer label={t('users.filters')} active={[status, role, department].filter((v) => v !== 'all').length}>
              {(close) => (
                <MemberFilters
                  directory={directory}
                  value={{ status, role, department }}
                  onApply={(next) => {
                    setStatus(next.status)
                    setRole(next.role)
                    setDepartment(next.department)
                    close()
                  }}
                />
              )}
            </FilterDrawer>
          </div>
        </div>
        <div className="overflow-x-auto">
        <table className={table} aria-busy={list.isFetching}>
          <thead>
            <tr>
              <th className={th}>{t('users.col.name')}</th>
                            <th className={th}>{t('users.col.roles')}</th>
              <th className={th}>{t('users.col.departments')}</th>
              <th className={th}>{t('users.col.status')}</th>
              <th className={th}>{t('users.col.signIn')}</th>
              <th className={th}>{t('users.col.availability')}</th>
            </tr>
          </thead>
          <tbody>
            {list.isPending && (
              <tr className={tr}>
                <td colSpan={6} className={tdMessage}>{t('users.loadingMembers')}</td>
              </tr>
            )}
            {!list.isPending && visible.length === 0 && (
              <tr className={tr}>
                <td colSpan={6} className={tdMessage}>{members.length === 0 ? t('users.empty') : t('users.noMatch')}</td>
              </tr>
            )}
            {visible.map((member) => {
              const profile = profiles.of(member.userId)
              const user = profile?.state === 'found' ? profile.user : undefined
              return (
                <tr key={member.userId} className={tr}>
                  <td className={td}>
                    <Link to={`/admin/users/${encodeURIComponent(member.userId)}`} className="block rounded-lg no-underline focus-visible:outline-2 focus-visible:outline-aura-primary">
                      <UserChip profile={profile} showTitle={false} titleBeside />
                    </Link>
                  </td>
                  <td className={td}>
                    <div className="flex flex-wrap gap-1">
                      {member.tenantRoles.map((r) => (
                        <RoleBadge key={r} role={r} />
                      ))}
                    </div>
                  </td>
                  <td className={td}>
                    <ul className="flex flex-col gap-1">
                      {member.departments.map((d) => (
                        <li key={d.departmentId} className="w-fit max-w-56 rounded-md bg-aura-canvas px-2 py-0.5 text-xs text-aura-text ring-1 ring-aura-border">
                          <DepartmentLabel departmentId={d.departmentId} level={d.level} directory={directory} />
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className={td}>
                    <StatusPill kind={statusOf(member, profile)} />
                  </td>
                  <td className={td}>{user && <SignInBadge source={user.source} />}</td>
                  <td className={td}>{user?.availability && <AvailabilityDot availability={user.availability} />}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>

      {!list.isPending && members.length > 0 && <p className="text-xs text-aura-muted">{t('users.shown', { count: visible.length })}</p>}
      {filtered && list.hasNextPage && <p className="text-sm text-aura-muted">{t('users.filter.partial', { count: members.length })}</p>}
      {list.hasNextPage && (
        <button type="button" className={`${btnOutline} self-start`} disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
          {t('users.loadMore')}
        </button>
      )}
    </div>
  )
}
