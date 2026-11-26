import type { Cursor } from '../value-objects/Cursor'
import type { RecordVersion } from '../value-objects/RecordVersion'
import type { DepartmentLevel, TenantRole } from '../vocabulary'
import type { UserSummary } from './user'

/** A department the member belongs to, at a level. Names come from the catalogue, labels from P-12. */
export interface DepartmentAssignment {
  readonly departmentId: string
  readonly level: DepartmentLevel
}

export type MemberStatus = 'active' | 'suspended'

/** A tenant membership (P-4, P-5): IDs only. `member` is implicit and never in `tenantRoles`. */
export interface Member {
  readonly userId: string
  readonly status: MemberStatus
  readonly tenantRoles: readonly TenantRole[]
  readonly departments: readonly DepartmentAssignment[]
  readonly recordVersion: RecordVersion
}

/**
 * What User Profile said about a member (IAM-UX-4): found, "Unknown user" (the service listed the ID
 * as missing), or "Name unavailable" (the batch call failed). A row is never hidden for lack of one.
 */
export type ProfileState =
  | { readonly state: 'found'; readonly user: UserSummary }
  | { readonly state: 'missing' }
  | { readonly state: 'unavailable' }

/** A member row as E1 shows it: the membership joined with its profile. */
export interface MemberRow {
  readonly member: Member
  readonly profile: ProfileState
}

/** One page of the member list. */
export interface MemberPage {
  readonly members: readonly Member[]
  /** Absent on the last page. */
  readonly nextCursor?: Cursor
}

/** A department's member with level (P-9). */
export interface DepartmentMemberRef {
  readonly userId: string
  readonly level: DepartmentLevel
}

/**
 * How a removal or demotion blocked by live work is resolved (P-26, E2a step 2): hand the member's
 * coverage to another active member, or stop the workflows they are covering.
 */
export type RemovalResolution =
  | { readonly action: 'replace_delegate'; readonly replacementUserId: string }
  | { readonly action: 'stop_workflows' }

/** What P-7 answers: the new status and the version to use next. */
export interface MemberStatusChange {
  readonly userId: string
  readonly status: MemberStatus
  readonly recordVersion: RecordVersion
}

/** What P-28 answers: the member's role list after the replacement. */
export interface RolesChange {
  readonly userId: string
  readonly roles: readonly TenantRole[]
}
