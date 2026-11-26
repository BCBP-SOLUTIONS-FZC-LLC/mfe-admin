import type { RecordVersion } from '../value-objects/RecordVersion'

// A user as the admin screens show them: the User Profile fields this remote reads
// (POST /users:batch, GET /users/:id). Names come from User Profile, membership from Org & Membership (IAM-UX-4).

export type UserSource = 'local' | 'federated'
export type UserStatus = 'active' | 'disabled' | 'deleted'
export type Availability = 'available' | 'busy' | 'ooo'

export interface UserSummary {
  readonly userId: string
  readonly displayName: string
  readonly email: string
  readonly jobTitle?: string
  readonly source: UserSource
  readonly status: UserStatus
  readonly availability?: Availability
  readonly provisional: boolean
  /** A federated user's name or title edited here no longer follows the identity provider (IAM-UX-11): offer "Revert to directory value". */
  readonly displayNameOverridden?: boolean
  readonly jobTitleOverridden?: boolean
  readonly recordVersion: RecordVersion
}

/** The answer to a batch lookup: the profiles found, and the IDs with no profile ("Unknown user"). */
export interface UserBatch {
  readonly users: readonly UserSummary[]
  readonly missing: readonly string[]
}
