// Picks one active member of the workspace (a replacement, a delegate). There is no server-side name
// search (IAM-FE-Q5), so it lists the member pages loaded so far with names from User Profile, and
// "Load more" for the rest.
//
// Replaced by the shared identity package's picker (LLD §15 #5).
import { useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { useMemo } from 'react'
import { APP_ID } from '../../../shared/constants/app'
import { useUserProfiles } from '../../features/identity/useUserProfiles'
import { useMemberList } from '../../features/members/useMembers'
import { btnOutline, input } from '../styles'

export default function MemberPicker({ label, value, onChange, excludeUserId, includeSuspended = false, emptyLabel }: { label: string; value: string; onChange: (userId: string) => void; excludeUserId?: string; includeSuspended?: boolean; emptyLabel?: string }) {
  const t = useT(APP_ID)
  const list = useMemberList()
  const active = useMemo(() => (list.data?.pages.flatMap((p) => p.members) ?? []).filter((m) => (includeSuspended || m.status === 'active') && m.userId !== excludeUserId), [list.data, excludeUserId, includeSuspended])
  const profiles = useUserProfiles(useMemo(() => active.map((m) => m.userId), [active]))
  return (
    <div className="flex flex-col gap-1">
      <label className="flex flex-col gap-1.5 text-sm font-medium text-aura-text">
        {label}
        <select className={input} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{emptyLabel ?? t('resolve.pickerEmpty')}</option>
          {active.map((m) => {
            const p = profiles.of(m.userId)
            const name = p?.state === 'found' ? p.user.displayName : p?.state === 'missing' ? t('identity.unknownUser') : t('identity.nameUnavailable')
            return (
              <option key={m.userId} value={m.userId}>
                {p === undefined ? t('common.loading') : name}
              </option>
            )
          })}
        </select>
      </label>
      {list.hasNextPage && (
        <button type="button" className={`${btnOutline} self-start`} disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
          {t('users.loadMore')}
        </button>
      )}
    </div>
  )
}
