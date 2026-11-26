import type { UserBatch, UserSummary } from '../entities/user'
import type { RecordVersion } from '../value-objects/RecordVersion'

/** What an admin may change on another user's profile (same rules as the user's own, G1). */
export interface UserProfileEdit {
  readonly displayName?: string
  readonly jobTitle?: string
  readonly phone?: string
  readonly timezone?: string
  readonly locale?: string
  /** Go back to the directory's value (sets `*_overridden` to false; the name or title is then not sent). */
  readonly revertDisplayName?: boolean
  readonly revertJobTitle?: boolean
  /** The version being replaced: User Profile calls it `expected_version` in the request. */
  readonly expectedVersion: RecordVersion
}

/** User Profile (IAM): the part the admin screens call. */
export interface UserProfilePort {
  /** `POST /users:batch`: 1 to 200 distinct IDs per call (the caller chunks; see userBatcher). */
  batch(ids: readonly string[], signal?: AbortSignal): Promise<UserBatch>
  /** `GET /users/:id` */
  getUser(userId: string, signal?: AbortSignal): Promise<UserSummary>
  /** `PATCH /users/:id` (admin or owner, for another user). */
  updateUser(userId: string, edit: UserProfileEdit, signal?: AbortSignal): Promise<UserSummary>
}
