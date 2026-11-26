// E2 profile: what User Profile says, and an admin's edit of name and job title (expected_version).
// A federated user's name or title follows the directory until edited here; "Revert" goes back to it
// (IAM-UX-11). A lost lock race (409) offers Reload.
import { useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { useId, useState } from 'react'
import type { UserSummary } from '../../../domain/entities/user'
import { planProfileEdit, type ProfileEditFailure } from '../../../domain/rules/admin-rules'
import { APP_ID } from '../../../shared/constants/app'
import ConflictDialog from '../../components/ConflictDialog'
import ProblemDetails from '../../components/ProblemDetails'
import type { AdminAccess } from '../../features/access/useAdminAccess'
import { useUpdateUser } from '../../features/members/useMemberDetail'
import { useAdminServices } from '../../features/services'
import { useProblemText } from '../../features/useProblemText'

const FAILURE_KEYS = {
  'name-required': 'detail.profile.error.name',
  'name-too-long': 'detail.profile.error.nameLong',
  'title-too-long': 'detail.profile.error.titleLong',
  'no-change': 'detail.profile.error.noChange',
} as const satisfies Record<ProfileEditFailure, string>

export default function ProfileCard({ user, access, saved, onSaved, onEdit, onReload }: { user: UserSummary; access: AdminAccess; saved: boolean; onSaved: () => void; onEdit: () => void; onReload: () => void }) {
  const t = useT(APP_ID)
  const problemText = useProblemText()
  const { problems } = useAdminServices()
  const update = useUpdateUser(user.userId)
  const id = useId()
  const [displayName, setDisplayName] = useState(user.displayName)
  const [jobTitle, setJobTitle] = useState(user.jobTitle ?? '')
  const [invalid, setInvalid] = useState<ProfileEditFailure | undefined>()
  const editable = access.canManageMembers

  const send = (edit: Parameters<typeof update.mutate>[0]) => {
    onEdit()
    // mutateAsync, not a callback passed to mutate: this card is keyed by the record's version, so a save remounts it while the refetch is in flight, and a callback passed to mutate is skipped for an unmounted component
    void update.mutateAsync(edit).then(onSaved, () => {})
  }

  const submit = () => {
    const plan = planProfileEdit({ displayName, jobTitle }, user)
    if (!plan.ok) {
      setInvalid(plan.failure)
      return
    }
    setInvalid(undefined)
    send(plan.value)
  }

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-2">
      <h2 id={`${id}-title`} className="text-lg font-semibold">
        {t('detail.profile.title')}
      </h2>
      <p>
        <span className="text-base-content/70">{t('detail.profile.email')}: </span>
        {user.email}
      </p>
      {user.source === 'federated' && <p className="text-sm text-base-content/70">{t('detail.profile.directoryNote')}</p>}
      <label className="flex flex-col gap-1" htmlFor={`${id}-name`}>
        {t('detail.profile.name')}
        <input id={`${id}-name`} className="input" value={displayName} disabled={!editable} onChange={(e) => (onEdit(), setDisplayName(e.target.value))} />
      </label>
      <label className="flex flex-col gap-1" htmlFor={`${id}-title-input`}>
        {t('detail.profile.jobTitle')}
        <input id={`${id}-title-input`} className="input" value={jobTitle} disabled={!editable} onChange={(e) => (onEdit(), setJobTitle(e.target.value))} />
      </label>
      {invalid && (
        <p role="alert" className="text-error">
          {t(FAILURE_KEYS[invalid])}
        </p>
      )}
      {update.isError && !problems.isConflict(update.error) && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-error">
          <span>{problemText(update.error)}</span>
          <ProblemDetails error={update.error} />
        </div>
      )}
      {saved && <p role="status">{t('detail.profile.saved')}</p>}
      {editable && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary btn-sm" disabled={update.isPending} onClick={submit}>
            {t('detail.profile.save')}
          </button>
          {user.source === 'federated' && user.displayNameOverridden && (
            <button type="button" className="btn btn-sm" disabled={update.isPending} onClick={() => send({ revertDisplayName: true, expectedVersion: user.recordVersion })}>
              {t('detail.profile.revertName')}
            </button>
          )}
          {user.source === 'federated' && user.jobTitleOverridden && (
            <button type="button" className="btn btn-sm" disabled={update.isPending} onClick={() => send({ revertJobTitle: true, expectedVersion: user.recordVersion })}>
              {t('detail.profile.revertTitle')}
            </button>
          )}
        </div>
      )}
      {update.isError && problems.isConflict(update.error) && (
        <ConflictDialog
          onClose={() => update.reset()}
          onReload={() => {
            update.reset()
            onReload()
          }}
        />
      )}
    </section>
  )
}
