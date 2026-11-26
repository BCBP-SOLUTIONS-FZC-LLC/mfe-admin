// Org & Membership over the SDK ApiClient (spec §11.1). Route templates start at /v1: the client adds
// the same-origin /api prefix. Param names match the Swagger's path parameters, so the contract
// test can compare them exactly. Nothing here retries a write: the ApiClient already retries safe
// calls with Retry-After, and a 409 or 422 is the answer.
import type { OrgMembershipPort } from '../../domain/repositories/OrgMembershipPort'
import type { DepartmentLevel } from '../../domain/vocabulary'
import type { RecordVersion } from '../../domain/value-objects/RecordVersion'
import type { Cursor } from '../../domain/value-objects/Cursor'
import {
  toDepartmentMembers,
  toDepartmentVersion,
  toInvitation,
  toInvitationBody,
  toInvitations,
  toMember,
  toMemberPage,
  toMemberStatusChange,
  toResolutionBody,
  toRoleLabel,
  toRoleLabels,
  toRolesChange,
  toSeatUsage,
  toTenantDepartments,
  toTenantPatchBody,
  toTenantSettings,
} from './mappers'
import { requireTenant, withSignal, type ApiScope } from './scope'

export function createOrgMembershipAdapter(scope: ApiScope): OrgMembershipPort {
  const { client } = scope
  const id = () => requireTenant(scope)
  const sig = withSignal

  return {
    async getTenant(signal) {
      const res = await client.get('/v1/tenants/:id', { params: { id: id() }, ...sig(signal) })
      return toTenantSettings(res.data)
    },
    async updateTenant(patch, signal) {
      const res = await client.patch('/v1/tenants/:id', { params: { id: id() }, body: toTenantPatchBody(patch), ...sig(signal) })
      // 202: the realm part is still applying (realm_sync_pending): show "Saving to sign-in settings…".
      const settings = toTenantSettings(res.data, res.status === 202)
      return { settings, realmSyncPending: settings.realmSyncPending }
    },

    async listDepartments(signal) {
      const res = await client.get('/v1/tenants/:id/departments', { params: { id: id() }, ...sig(signal) })
      return toTenantDepartments(res.data)
    },
    async activateDepartment(departmentId, signal) {
      const res = await client.post('/v1/tenants/:id/departments', { params: { id: id() }, body: { department_id: departmentId }, ...sig(signal) })
      return toDepartmentVersion(res.data)
    },
    async setDepartmentActive(departmentId, isActive, recordVersion, signal) {
      const res = await client.patch('/v1/tenants/:id/departments/:dept_id', {
        params: { id: id(), dept_id: departmentId },
        body: { is_active: isActive, record_version: recordVersion },
        ...sig(signal),
      })
      return toDepartmentVersion(res.data)
    },
    async listDepartmentMembers(departmentId, signal) {
      const res = await client.get('/v1/tenants/:id/departments/:dept_id/members', { params: { id: id(), dept_id: departmentId }, ...sig(signal) })
      return toDepartmentMembers(res.data)
    },
    async assignDepartment(departmentId, userId, level: DepartmentLevel, signal) {
      await client.put('/v1/tenants/:id/departments/:dept_id/members/:user_id', { params: { id: id(), dept_id: departmentId, user_id: userId }, body: { level }, ...sig(signal) })
    },
    async removeFromDepartment(departmentId, userId, signal) {
      await client.delete('/v1/tenants/:id/departments/:dept_id/members/:user_id', { params: { id: id(), dept_id: departmentId, user_id: userId }, ...sig(signal) })
    },

    async listMembers(page: { readonly limit?: number; readonly cursor?: Cursor }, signal) {
      const res = await client.get('/v1/tenants/:id/members', {
        params: { id: id() },
        query: { ...(page.limit !== undefined ? { limit: page.limit } : {}), ...(page.cursor ? { cursor: page.cursor } : {}) },
        ...sig(signal),
      })
      return toMemberPage(res.data)
    },
    async getMember(userId, signal) {
      const res = await client.get('/v1/tenants/:id/members/:user_id', { params: { id: id(), user_id: userId }, ...sig(signal) })
      return toMember(res.data)
    },
    async invite(request, signal) {
      const res = await client.post('/v1/tenants/:id/members', { params: { id: id() }, body: toInvitationBody(request), ...sig(signal) })
      return toInvitation(res.data)
    },
    async listInvitations(signal) {
      const res = await client.get('/v1/tenants/:id/invitations', { params: { id: id() }, ...sig(signal) })
      return toInvitations(res.data)
    },
    async revokeInvitation(invitationId, recordVersion: RecordVersion, signal) {
      await client.delete('/v1/tenants/:id/invitations/:invitation_id', {
        params: { id: id(), invitation_id: invitationId },
        body: { record_version: recordVersion },
        ...sig(signal),
      })
    },
    async setMemberStatus(userId, status, recordVersion, signal) {
      const res = await client.patch('/v1/tenants/:id/members/:user_id', {
        params: { id: id(), user_id: userId },
        body: { status, record_version: recordVersion },
        ...sig(signal),
      })
      return toMemberStatusChange(res.data)
    },
    async removeMember(userId, signal) {
      await client.delete('/v1/tenants/:id/members/:user_id', { params: { id: id(), user_id: userId }, ...sig(signal) })
    },
    async resolveRemoval(userId, resolution, signal) {
      await client.post('/v1/tenants/:id/users/:user_id/removal-resolution', { params: { id: id(), user_id: userId }, body: toResolutionBody(resolution), ...sig(signal) })
    },
    async setRoles(userId, roles, signal) {
      const res = await client.put('/v1/tenants/:id/members/:user_id/roles', { params: { id: id(), user_id: userId }, body: { roles: [...roles] }, ...sig(signal) })
      return toRolesChange(res.data)
    },
    async resetMfa(userId, signal) {
      await client.post('/v1/tenants/:id/members/:user_id/reset-mfa', { params: { id: id(), user_id: userId }, ...sig(signal) })
    },

    async getSeatUsage(signal) {
      const res = await client.get('/v1/tenants/:id/seat-usage', { params: { id: id() }, ...sig(signal) })
      return toSeatUsage(res.data)
    },
    async listRoleLabels(signal) {
      const res = await client.get('/v1/tenants/:id/roles', { params: { id: id() }, ...sig(signal) })
      return toRoleLabels(res.data)
    },
    async renameRoleLabel(roleCode, displayName, recordVersion, signal) {
      const res = await client.patch('/v1/tenants/:id/roles/:role_code', {
        params: { id: id(), role_code: roleCode },
        body: { display_name: displayName, record_version: recordVersion },
        ...sig(signal),
      })
      return toRoleLabel(res.data)
    },
  }
}
