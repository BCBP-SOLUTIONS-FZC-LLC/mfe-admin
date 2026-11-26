// How strictly service answers are read: a missing or mistyped field the screens depend on is a
// MappingError (never an `undefined` in the UI); a field the service adds is ignored; a list the
// service leaves out or sends as null (a Go nil slice) is empty.
import { describe, expect, it } from '@rstest/core'
import { MappingError } from '../../../src/infrastructure/api/readers'
import {
  emptyGroupMappings,
  toAuditEntry,
  toAuditExport,
  toAuditExportBody,
  toAuditPage,
  toAuditQuery,
  toCatalog,
  toDelegationPolicy,
  toDepartmentMappings,
  toDepartmentMembers,
  toInvitation,
  toInvitations,
  toLevelMappings,
  toMember,
  toMemberPage,
  toRoleLabels,
  toRolesChange,
  toTenantDepartments,
  toTenantRoleMappings,
  toTenantSettings,
  toUser,
  toUserBatch,
  toUserEditBody,
} from '../../../src/infrastructure/api/mappers'
import { EMPTY_AUDIT_FILTER } from '../../../src/domain/value-objects/AuditFilter'
import { recordVersion } from '../../../src/domain/value-objects/RecordVersion'
import * as f from '../../contract/fixtures'

/** A copy of `o` without the named keys. */
function omit<T extends Record<string, unknown>>(o: T, ...keys: string[]): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)))
}

describe('lists the service leaves out or sends as null are empty', () => {
  it.each([
    ['members', () => toMemberPage({ items: null })],
    ['members, absent', () => toMemberPage({})],
    ['departments', () => toTenantDepartments({ items: null })],
    ['department members', () => toDepartmentMembers({ items: [] })],
    ['invitations', () => toInvitations({})],
    ['role labels', () => toRoleLabels({ items: null })],
    ['catalogue', () => toCatalog({})],
    ['department mappings', () => toDepartmentMappings({ mappings: null })],
    ['level mappings', () => toLevelMappings({})],
    ['tenant role mappings', () => toTenantRoleMappings({ mappings: null })],
  ])('%s', (_name, read) => {
    const result = read()
    expect(Array.isArray(result) ? result : result.members).toEqual([])
  })

  it('an audit page with no events, and a batch with no users or missing IDs', () => {
    expect(toAuditPage({ events: null }).entries).toEqual([])
    expect(toUserBatch({})).toEqual({ users: [], missing: [] })
  })

  it('a member with no departments or roles', () => {
    expect(toMember({ user_id: 'u', status: 'active', record_version: 1 })).toMatchObject({ tenantRoles: [], departments: [] })
  })

  it('has an empty set of group mappings', () => {
    expect(emptyGroupMappings()).toEqual({ departments: [], levels: [], tenantRoles: [] })
  })
})

describe('a missing or mistyped field is a MappingError that names it', () => {
  const bad = (read: () => unknown, path: string) => {
    try {
      read()
    } catch (e) {
      expect(e).toBeInstanceOf(MappingError)
      expect((e as MappingError).path).toBe(path)
      return
    }
    throw new Error(`expected a MappingError at ${path}`)
  }

  it('a member without user_id', () => bad(() => toMember({ status: 'active', record_version: 1 }), 'member.user_id'))
  it('a member of an unknown status', () => bad(() => toMember({ user_id: 'u', status: 'left', record_version: 1 }), 'member.status'))
  it('a member with an unknown department level', () =>
    bad(() => toMember({ user_id: 'u', status: 'active', record_version: 1, departments: [{ department_id: 'd', level: 'boss' }] }), 'member.departments[0].level'))
  it('a record version that is not an integer', () => bad(() => toMember({ user_id: 'u', status: 'active', record_version: '3' }), 'member.record_version'))
  it('a negative record version', () => bad(() => toMember({ user_id: 'u', status: 'active', record_version: -1 }), 'member.record_version'))
  it('an invitation with only the legacy `id`: invitation_id is the one that is read', () =>
    bad(() => toInvitation({ ...f.invitationItem, invitation_id: undefined }), 'invitation.invitation_id'))
  it('an answer that is not an object', () => bad(() => toTenantSettings('nope'), 'tenant'))
  it('a list that is not an array', () => bad(() => toMemberPage({ items: {} }), 'members.items'))
  it('a tenant of an unknown plan', () => bad(() => toTenantSettings({ ...f.tenant, plan: 'platinum' }), 'tenant.plan'))
  it('a tenant without a boolean setting', () => bad(() => toTenantSettings({ ...f.tenant, local_accounts_enabled: 'yes' }), 'tenant.local_accounts_enabled'))
  it('an audit actor of an unknown type', () => bad(() => toAuditEntry({ ...f.auditEvent, actor: { type: 'robot' } }), 'audit.actor.type'))
  it('an audit entry without an actor', () => bad(() => toAuditEntry({ ...f.auditEvent, actor: undefined }), 'audit.actor'))
  it('a delegation policy without days', () => bad(() => toDelegationPolicy({ record_version: 1 }), 'delegationPolicy.max_duration_days'))
  it('a batch whose missing list holds a non-string', () => bad(() => toUserBatch({ users: [], missing: [7] }), 'batch.missing[0]'))
  it('a group mapping with an unknown tenant role', () =>
    bad(() => toTenantRoleMappings({ mappings: [{ keycloak_group_name: 'g', role_code: 'root' }] }), 'tenantRoleMappings.role_code'))
  it('a role-label answer with an unknown code', () => bad(() => toRoleLabels({ items: [{ role_code: 'boss', display_name: 'B', record_version: 1 }] }), 'roleLabels.items[0].role_code'))
})

describe('what is ignored or defaulted', () => {
  it('ignores a field the service adds', () => {
    expect(toMember({ ...f.memberItem, brand_new_field: 1 }).userId).toBe(f.U1)
  })

  it('drops a role the UI does not know and the implicit member role', () => {
    expect(toMember({ ...f.memberItem, tenant_roles: ['member', 'tenant_admin', 'auditor'] }).tenantRoles).toEqual(['tenant_admin'])
    expect(toRolesChange({ user_id: f.U1, roles: ['member', 'tender_admin'] }).roles).toEqual(['tender_admin'])
  })

  it('defaults residency to standard when the service omits it', () => {
    expect(toTenantSettings(omit(f.tenant, 'residency_mode')).residencyMode).toBe('standard')
    expect(toTenantSettings({ ...f.tenant, residency_mode: 'strict' }).residencyMode).toBe('strict')
  })

  it('reads realm_sync_pending from the body, and a 202 as pending whatever the body says', () => {
    expect(toTenantSettings({ ...f.tenant, realm_sync_pending: true }).realmSyncPending).toBe(true)
    expect(toTenantSettings(f.tenant).realmSyncPending).toBe(false)
    expect(toTenantSettings(f.tenant, true).realmSyncPending).toBe(true)
  })

  it('reads an invitation by invitation_id, ignoring the legacy id', () => {
    expect(toInvitation(f.invitationItem).invitationId).toBe(f.INV)
  })

  it('treats a blank optional string as absent', () => {
    const entry = toAuditEntry({ ...f.auditEvent, ip_address: '', trace_id: '', target: { type: '', id: '' }, actor: { type: 'iam_system', display: '' } })
    expect(entry.ipAddress).toBeUndefined()
    expect(entry.traceId).toBeUndefined()
    expect(entry.target).toBeUndefined()
    expect(entry.actor).toEqual({ type: 'iam_system' })
  })

  it('reads an audit entry with no target, retention tier or metadata', () => {
    const entry = toAuditEntry(omit(f.auditEvent, 'target', 'retention_tier', 'metadata'))
    expect(entry.metadata).toEqual({})
    expect(entry.retentionTier).toBeUndefined()
    expect(entry.target).toBeUndefined()
  })

  it('drops a retention tier it does not know', () => {
    expect(toAuditEntry({ ...f.auditEvent, retention_tier: 'forever' }).retentionTier).toBeUndefined()
  })

  it('reads a user with no availability, an unknown availability, no job title, and provisional unset', () => {
    const bare = omit(f.userProfile, 'availability', 'job_title', 'provisional')
    expect(toUser(bare)).toMatchObject({ provisional: false })
    expect(toUser(bare).availability).toBeUndefined()
    expect(toUser(bare).jobTitle).toBeUndefined()
    expect(toUser({ ...f.userProfile, availability: { status: 'dnd' } }).availability).toBeUndefined()
    expect(toUser({ ...f.userProfile, availability: null }).availability).toBeUndefined()
  })

  it('reads an export that is still pending, with only its ID and status', () => {
    expect(toAuditExport({ export_id: 'ex-1', status: 'pending' })).toEqual({ exportId: 'ex-1', status: 'pending' })
  })

  it('keeps a record version a branded number', () => {
    expect(toMember(f.memberItem).recordVersion).toBe(recordVersion(3))
  })
})

describe('what an admin may change on a profile', () => {
  it('writes only the fields given, and always the version being replaced as expected_version', () => {
    expect(toUserEditBody({ expectedVersion: recordVersion(2) })).toEqual({ expected_version: 2 })
    expect(toUserEditBody({ displayName: 'Ada', jobTitle: 'CTO', phone: '+44', timezone: 'Europe/London', locale: 'en-GB', expectedVersion: recordVersion(2) })).toEqual({
      display_name: 'Ada',
      job_title: 'CTO',
      phone: '+44',
      timezone: 'Europe/London',
      locale: 'en-GB',
      expected_version: 2,
    })
  })
})

describe('an audit target', () => {
  it('is kept with only a type, or only an ID', () => {
    expect(toAuditEntry({ ...f.auditEvent, target: { type: 'member' } }).target).toEqual({ type: 'member' })
    expect(toAuditEntry({ ...f.auditEvent, target: { id: f.U2 } }).target).toEqual({ id: f.U2 })
  })
})

describe('audit request shapes', () => {
  it('writes a search with only the filters set, the first entry type, and the page', () => {
    expect(toAuditQuery(EMPTY_AUDIT_FILTER, 100)).toEqual({ limit: 100 })
    expect(
      toAuditQuery(
        { entryTypes: ['a.b'], from: 'F', to: 'T', actorId: 'A', actorType: 'user', targetType: 'member', targetId: 'X', sourceService: 'svc', retentionTier: 'access_90d' },
        50,
        'CUR',
      ),
    ).toEqual({ limit: 50, from: 'F', to: 'T', entry_type: 'a.b', actor_id: 'A', actor_type: 'user', target_type: 'member', target_id: 'X', source_service: 'svc', retention_tier: 'access_90d', cursor: 'CUR' })
  })

  it('writes an export body with every entry type, and an empty body for no filter', () => {
    expect(toAuditExportBody(EMPTY_AUDIT_FILTER)).toEqual({})
    expect(toAuditExportBody({ entryTypes: ['a', 'b'], from: 'F', to: 'T', actorId: 'A', actorType: 'user', targetType: 'm', targetId: 'X', sourceService: 's', retentionTier: 'security_3y' })).toEqual({
      from: 'F',
      to: 'T',
      entry_type: ['a', 'b'],
      actor_id: 'A',
      actor_type: 'user',
      target_type: 'm',
      target_id: 'X',
      source_service: 's',
      retention_tier: 'security_3y',
    })
  })
})
