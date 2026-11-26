import type { DepartmentMemberRef, Member, MemberPage, MemberStatusChange, RemovalResolution, RolesChange } from '../entities/member'
import type { Invitation, InvitationRequest } from '../entities/invitation'
import type { DepartmentVersion, RoleLabel, TenantDepartment } from '../entities/department'
import type { SeatUsage } from '../entities/seats'
import type { TenantSettings, TenantSettingsPatch, TenantSettingsSaved } from '../entities/settings'
import type { Cursor } from '../value-objects/Cursor'
import type { RecordVersion } from '../value-objects/RecordVersion'
import type { DepartmentLevel, TenantRole } from '../vocabulary'

/**
 * Org & Membership (IAM), the routes of spec §11.1 the admin screens call. Every method takes an
 * optional abort signal; adapters map snake_case to these types and the workspace comes from the
 * session, never from the caller (IAM-UX-1). Writes that can fail on a stale version reject with a
 * `409` problem; the port does not retry.
 */
export interface OrgMembershipPort {
  /** P-1, P-2 */
  getTenant(signal?: AbortSignal): Promise<TenantSettings>
  updateTenant(patch: TenantSettingsPatch, signal?: AbortSignal): Promise<TenantSettingsSaved>

  /** P-3 */
  listDepartments(signal?: AbortSignal): Promise<readonly TenantDepartment[]>
  /** P-24: activate a catalogue department for the tenant. */
  activateDepartment(departmentId: string, signal?: AbortSignal): Promise<DepartmentVersion>
  /** P-25: retire or reactivate, with the version being replaced. */
  setDepartmentActive(departmentId: string, isActive: boolean, recordVersion: RecordVersion, signal?: AbortSignal): Promise<DepartmentVersion>
  /** P-9 */
  listDepartmentMembers(departmentId: string, signal?: AbortSignal): Promise<readonly DepartmentMemberRef[]>
  /** P-10: add or change a level (same call). */
  assignDepartment(departmentId: string, userId: string, level: DepartmentLevel, signal?: AbortSignal): Promise<void>
  /** P-11 */
  removeFromDepartment(departmentId: string, userId: string, signal?: AbortSignal): Promise<void>

  /** P-4: IDs only; join with User Profile for names (IAM-UX-4). */
  listMembers(page: { readonly limit?: number; readonly cursor?: Cursor }, signal?: AbortSignal): Promise<MemberPage>
  /** P-5 */
  getMember(userId: string, signal?: AbortSignal): Promise<Member>
  /** P-6: `202` with the pending invitation. */
  invite(request: InvitationRequest, signal?: AbortSignal): Promise<Invitation>
  /** P-30 */
  listInvitations(signal?: AbortSignal): Promise<readonly Invitation[]>
  /** P-31: frees the seat. */
  revokeInvitation(invitationId: string, recordVersion: RecordVersion, signal?: AbortSignal): Promise<void>
  /** P-7 */
  setMemberStatus(userId: string, status: 'active' | 'suspended', recordVersion: RecordVersion, signal?: AbortSignal): Promise<MemberStatusChange>
  /** P-8: may answer `409 WORKFLOW_RESOLUTION_REQUIRED` (E2a step 2). */
  removeMember(userId: string, signal?: AbortSignal): Promise<void>
  /** P-26: then the caller re-sends the original call. */
  resolveRemoval(userId: string, resolution: RemovalResolution, signal?: AbortSignal): Promise<void>
  /** P-28: full replacement of the role list. */
  setRoles(userId: string, roles: readonly TenantRole[], signal?: AbortSignal): Promise<RolesChange>
  /** P-34: needs fresh MFA (step-up first). */
  resetMfa(userId: string, signal?: AbortSignal): Promise<void>

  /** P-27 */
  getSeatUsage(signal?: AbortSignal): Promise<SeatUsage>
  /** P-12, P-13 */
  listRoleLabels(signal?: AbortSignal): Promise<readonly RoleLabel[]>
  renameRoleLabel(roleCode: DepartmentLevel, displayName: string, recordVersion: RecordVersion, signal?: AbortSignal): Promise<RoleLabel>
}
