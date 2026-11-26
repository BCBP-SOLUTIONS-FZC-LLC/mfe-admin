import type { RecordVersion } from '../value-objects/RecordVersion'
import type { DepartmentLevel, TenantRole } from '../vocabulary'

/** A pending invitation (P-30). Only `pending` is listed; expired and revoked ones drop off. */
export interface Invitation {
  /** `invitation_id`; the older `id` alias is being removed and is never read. */
  readonly invitationId: string
  readonly email: string
  readonly fullName: string
  readonly initialRoles: readonly TenantRole[]
  /** The inviting user's ID; the name comes from User Profile. */
  readonly invitedBy: string
  readonly sentAt: string
  readonly expiresAt: string
  readonly recordVersion: RecordVersion
}

/** The P-6 body. */
export interface InvitationRequest {
  readonly email: string
  readonly fullName: string
  readonly initialTenantRoles: readonly TenantRole[]
  readonly initialDeptMappings: readonly { readonly departmentId: string; readonly level: DepartmentLevel }[]
}
