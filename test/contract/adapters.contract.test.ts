// Each adapter against the pinned IAM Swagger (docs: test/contract/swagger/PIN.json): the request it
// sends exists in the Swagger (method, path, declared query, body that validates and carries no
// unknown field), the fixture it is given is a valid answer for that status, and what it returns is
// the domain value the screens expect. LLD §14.
import { createTestPlatform } from '@bcbp-solutions-fzc-llc/frontend-sdk/testing'
import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core'
import { createAuditAdapter } from '../../src/infrastructure/api/audit'
import { createCatalogAdapter } from '../../src/infrastructure/api/catalog'
import { createDelegationPolicyAdapter } from '../../src/infrastructure/api/delegationPolicy'
import { createGroupMappingAdapter } from '../../src/infrastructure/api/groupMapping'
import { createOrgMembershipAdapter } from '../../src/infrastructure/api/orgMembership'
import { createUserProfileAdapter } from '../../src/infrastructure/api/userProfile'
import { parseCursor } from '../../src/domain/value-objects/Cursor'
import { recordVersion } from '../../src/domain/value-objects/RecordVersion'
import { client, conformance, stubServer, TENANT } from './harness'
import * as f from './fixtures'

const scope = () => ({ client: client(), tenantId: () => TENANT })
const rv = recordVersion

beforeEach(() => {
  createTestPlatform()
})
afterEach(() => {
  rs.unstubAllGlobals()
})

interface Case {
  name: string
  status: number
  answer?: unknown
  /** Makes the call, given a fresh adapter set. */
  call: (a: ReturnType<typeof adapters>) => Promise<unknown>
  /** The request that should have gone out: `METHOD /path` with ids as sent. */
  sent: string
  /** What the adapter should return. */
  returns?: unknown
  /** The request body, when it is not covered by a dedicated test. */
  body?: unknown
  query?: [string, string][]
}

/** Every `port.method` the cases below called, to prove no adapter method goes untested. */
const called = new Set<string>()

/** The port with each method recorded when called. */
function recorded<P extends object>(name: string, port: P): P {
  return new Proxy(port, {
    get(target, method, receiver) {
      const value = Reflect.get(target, method, receiver)
      return typeof value === 'function' ? (...args: unknown[]) => (called.add(`${name}.${String(method)}`), value.apply(target, args)) : value
    },
  })
}

const makeAdapters = (wrap: <P extends object>(name: string, port: P) => P) => {
  const s = scope()
  return {
    org: wrap('org', createOrgMembershipAdapter(s)),
    users: wrap('users', createUserProfileAdapter(s)),
    catalog: wrap('catalog', createCatalogAdapter(s)),
    groups: wrap('groups', createGroupMappingAdapter(s)),
    audit: wrap('audit', createAuditAdapter(s)),
    delegation: wrap('delegation', createDelegationPolicyAdapter(s)),
  }
}

const adapters = () => makeAdapters(recorded)

const T = `/api/v1/tenants/${TENANT}`

const cases: Case[] = [
  // ── Org & Membership ────────────────────────────────────────────────────────
  {
    name: 'getTenant',
    status: 200,
    answer: f.tenant,
    call: (a) => a.org.getTenant(),
    sent: `GET ${T}`,
    returns: { name: 'Acme', defaultLocale: 'en', mfaFreshnessSeconds: 300, localAccountsEnabled: true, residencyMode: 'standard', recordVersion: rv(7), status: 'active', plan: 'pro', realmSyncPending: false },
  },
  {
    name: 'updateTenant (200: final)',
    status: 200,
    answer: f.tenant,
    call: (a) => a.org.updateTenant({ name: 'Acme Ltd', mfaFreshnessSeconds: 600, recordVersion: rv(7) }),
    sent: `PATCH ${T}`,
    body: { name: 'Acme Ltd', mfa_freshness_seconds: 600, record_version: 7 },
    returns: expect.objectContaining({ realmSyncPending: false }),
  },
  {
    name: 'updateTenant (202: the realm part is still applying)',
    status: 202,
    answer: f.tenant,
    call: (a) => a.org.updateTenant({ residencyMode: 'strict', localAccountsEnabled: false, defaultLocale: 'en-GB', recordVersion: rv(7) }),
    sent: `PATCH ${T}`,
    body: { default_locale: 'en-GB', local_accounts_enabled: false, residency_mode: 'strict', record_version: 7 },
    returns: expect.objectContaining({ realmSyncPending: true, settings: expect.objectContaining({ realmSyncPending: true }) }),
  },
  {
    name: 'listDepartments',
    status: 200,
    answer: f.departmentList,
    call: (a) => a.org.listDepartments(),
    sent: `GET ${T}/departments`,
    returns: [
      { departmentId: f.D1, code: 'ENG', name: 'Engineering', isActive: true, isSystem: true, recordVersion: rv(1) },
      { departmentId: f.D2, code: 'QAQC', name: 'QA / QC', isActive: false, isSystem: false, recordVersion: rv(4) },
    ],
  },
  {
    name: 'activateDepartment',
    status: 201,
    answer: f.departmentVersion,
    call: (a) => a.org.activateDepartment(f.D2),
    sent: `POST ${T}/departments`,
    body: { department_id: f.D2 },
    returns: { departmentId: f.D2, isActive: true, recordVersion: rv(5) },
  },
  {
    name: 'setDepartmentActive',
    status: 200,
    answer: { ...f.departmentVersion, is_active: false },
    call: (a) => a.org.setDepartmentActive(f.D2, false, rv(4)),
    sent: `PATCH ${T}/departments/${f.D2}`,
    body: { is_active: false, record_version: 4 },
    returns: { departmentId: f.D2, isActive: false, recordVersion: rv(5) },
  },
  {
    name: 'listDepartmentMembers',
    status: 200,
    answer: f.departmentMembers,
    call: (a) => a.org.listDepartmentMembers(f.D1),
    sent: `GET ${T}/departments/${f.D1}/members`,
    returns: [{ userId: f.U1, level: 'approver' }, { userId: f.U2, level: 'preparator' }],
  },
  {
    name: 'assignDepartment',
    status: 200,
    answer: f.departmentAssigned,
    call: (a) => a.org.assignDepartment(f.D1, f.U1, 'reviewer'),
    sent: `PUT ${T}/departments/${f.D1}/members/${f.U1}`,
    body: { level: 'reviewer' },
    returns: undefined,
  },
  {
    name: 'removeFromDepartment',
    status: 200,
    answer: f.departmentRemoved,
    call: (a) => a.org.removeFromDepartment(f.D1, f.U1),
    sent: `DELETE ${T}/departments/${f.D1}/members/${f.U1}`,
    returns: undefined,
  },
  {
    name: 'listMembers (first page)',
    status: 200,
    answer: f.memberPage,
    call: (a) => a.org.listMembers({ limit: 50 }),
    sent: `GET ${T}/members`,
    query: [['limit', '50']],
    returns: {
      members: [
        { userId: f.U1, status: 'active', tenantRoles: ['tenant_admin', 'tender_admin'], departments: [{ departmentId: f.D1, level: 'reviewer' }], recordVersion: rv(3) },
        { userId: f.U2, status: 'suspended', tenantRoles: [], departments: [], recordVersion: rv(3) },
      ],
      nextCursor: parseCursor('eyJpZCI6Mn0='),
    },
  },
  {
    name: 'listMembers (no page size: the service default)',
    status: 200,
    answer: { items: [] },
    call: (a) => a.org.listMembers({}),
    sent: `GET ${T}/members`,
    returns: { members: [] },
  },
  {
    name: 'listMembers (next page, last page)',
    status: 200,
    answer: { items: [] },
    call: (a) => a.org.listMembers({ limit: 50, cursor: parseCursor('eyJpZCI6Mn0=')! }),
    sent: `GET ${T}/members`,
    query: [['limit', '50'], ['cursor', 'eyJpZCI6Mn0=']],
    returns: { members: [] },
  },
  {
    name: 'getMember',
    status: 200,
    answer: f.memberItem,
    call: (a) => a.org.getMember(f.U1),
    sent: `GET ${T}/members/${f.U1}`,
    returns: { userId: f.U1, status: 'active', tenantRoles: ['tenant_admin', 'tender_admin'], departments: [{ departmentId: f.D1, level: 'reviewer' }], recordVersion: rv(3) },
  },
  {
    name: 'invite (202), reading invitation_id and never the legacy id',
    status: 202,
    answer: f.invitationItem,
    call: (a) =>
      a.org.invite({ email: 'ada@example.com', fullName: 'Ada Lovelace', initialTenantRoles: ['tender_admin'], initialDeptMappings: [{ departmentId: f.D1, level: 'reviewer' }] }),
    sent: `POST ${T}/members`,
    body: { email: 'ada@example.com', full_name: 'Ada Lovelace', initial_tenant_roles: ['tender_admin'], initial_dept_mappings: [{ department_id: f.D1, level: 'reviewer' }] },
    returns: { invitationId: f.INV, email: 'ada@example.com', fullName: 'Ada Lovelace', initialRoles: ['tender_admin'], invitedBy: f.U1, sentAt: f.AT, expiresAt: '2026-12-02T10:00:00Z', recordVersion: rv(1) },
  },
  {
    name: 'listInvitations',
    status: 200,
    answer: f.invitationList,
    call: async (a) => (await a.org.listInvitations()).map((i) => i.invitationId),
    sent: `GET ${T}/invitations`,
    returns: [f.INV],
  },
  {
    name: 'revokeInvitation (body carries the version)',
    status: 204,
    call: (a) => a.org.revokeInvitation(f.INV, rv(1)),
    sent: `DELETE ${T}/invitations/${f.INV}`,
    body: { record_version: 1 },
    returns: undefined,
  },
  {
    name: 'setMemberStatus',
    status: 200,
    answer: f.statusPatched,
    call: (a) => a.org.setMemberStatus(f.U2, 'suspended', rv(3)),
    sent: `PATCH ${T}/members/${f.U2}`,
    body: { status: 'suspended', record_version: 3 },
    returns: { userId: f.U2, status: 'suspended', recordVersion: rv(4) },
  },
  { name: 'removeMember', status: 204, call: (a) => a.org.removeMember(f.U2), sent: `DELETE ${T}/members/${f.U2}`, returns: undefined },
  {
    name: 'resolveRemoval: replace the delegate',
    status: 204,
    call: (a) => a.org.resolveRemoval(f.U2, { action: 'replace_delegate', replacementUserId: f.U1 }),
    sent: `POST ${T}/users/${f.U2}/removal-resolution`,
    body: { action: 'replace_delegate', replacement_user_id: f.U1 },
    returns: undefined,
  },
  {
    name: 'resolveRemoval: stop the workflows (no replacement in the body)',
    status: 204,
    call: (a) => a.org.resolveRemoval(f.U2, { action: 'stop_workflows' }),
    sent: `POST ${T}/users/${f.U2}/removal-resolution`,
    body: { action: 'stop_workflows' },
    returns: undefined,
  },
  {
    name: 'setRoles (full replacement)',
    status: 200,
    answer: f.rolesReplaced,
    call: (a) => a.org.setRoles(f.U1, ['tender_admin']),
    sent: `PUT ${T}/members/${f.U1}/roles`,
    body: { roles: ['tender_admin'] },
    returns: { userId: f.U1, roles: ['tender_admin'] },
  },
  { name: 'resetMfa', status: 204, call: (a) => a.org.resetMfa(f.U1), sent: `POST ${T}/members/${f.U1}/reset-mfa`, returns: undefined },
  {
    name: 'getSeatUsage',
    status: 200,
    answer: f.seatUsage,
    call: (a) => a.org.getSeatUsage(),
    sent: `GET ${T}/seat-usage`,
    returns: { activeUsers: 3, pendingInvitations: 1, licensedSeats: 10 },
  },
  {
    name: 'listRoleLabels',
    status: 200,
    answer: f.roleLabels,
    call: async (a) => (await a.org.listRoleLabels()).map((l) => [l.roleCode, l.displayName]),
    sent: `GET ${T}/roles`,
    returns: [['preparator', 'Engineer'], ['reviewer', 'Manager'], ['approver', 'Director']],
  },
  {
    name: 'renameRoleLabel',
    status: 200,
    answer: f.roleLabelRenamed,
    call: (a) => a.org.renameRoleLabel('approver', 'Head', rv(1)),
    sent: `PATCH ${T}/roles/approver`,
    body: { display_name: 'Head', record_version: 1 },
    returns: { roleCode: 'approver', displayName: 'Head', recordVersion: rv(2) },
  },

  // ── User Profile ────────────────────────────────────────────────────────────
  {
    name: 'batch (the `:batch` custom method, sent percent-encoded)',
    status: 200,
    answer: f.userBatch,
    call: (a) => a.users.batch([f.U1, f.U2]),
    sent: 'POST /api/v1/users:batch',
    body: { ids: [f.U1, f.U2] },
    returns: {
      users: [{ userId: f.U1, displayName: 'Ada Lovelace', email: 'ada@example.com', jobTitle: 'Chief Engineer', source: 'federated', status: 'active', availability: 'ooo', provisional: false, recordVersion: rv(2) }],
      missing: [f.U2],
    },
  },
  {
    name: 'getUser',
    status: 200,
    answer: f.userProfile,
    call: async (a) => (await a.users.getUser(f.U1)).displayName,
    sent: `GET /api/v1/users/${f.U1}`,
    returns: 'Ada Lovelace',
  },
  {
    name: 'updateUser (expected_version in the request)',
    status: 200,
    answer: { ...f.userProfile, job_title: 'Principal Engineer', record_version: 3 },
    call: async (a) => (await a.users.updateUser(f.U1, { jobTitle: 'Principal Engineer', expectedVersion: rv(2) })).recordVersion,
    sent: `PATCH /api/v1/users/${f.U1}`,
    body: { job_title: 'Principal Engineer', expected_version: 2 },
    returns: rv(3),
  },

  {
    name: 'updateUser: revert a federated user\'s name to the directory value (the name is not sent)',
    status: 200,
    answer: { ...f.userProfile, display_name_overridden: false, record_version: 4 },
    call: async (a) => (await a.users.updateUser(f.U1, { revertDisplayName: true, jobTitle: 'Head', expectedVersion: rv(3) })).displayNameOverridden,
    sent: `PATCH /api/v1/users/${f.U1}`,
    body: { display_name_overridden: false, job_title: 'Head', expected_version: 3 },
    returns: false,
  },
  {
    name: 'updateUser: revert the job title',
    status: 200,
    answer: { ...f.userProfile, job_title_overridden: false, record_version: 4 },
    call: async (a) => (await a.users.updateUser(f.U1, { revertJobTitle: true, expectedVersion: rv(3) })).jobTitleOverridden,
    sent: `PATCH /api/v1/users/${f.U1}`,
    body: { job_title_overridden: false, expected_version: 3 },
    returns: false,
  },

  // ── Catalog ─────────────────────────────────────────────────────────────────
  {
    name: 'catalog listDepartments (the catalogue calls its ID `id`)',
    status: 200,
    answer: f.catalog,
    call: (a) => a.catalog.listDepartments(),
    sent: 'GET /api/v1/departments',
    returns: [
      { departmentId: f.D1, code: 'ENG', name: 'Engineering', isActive: true, isSystem: true },
      { departmentId: f.D2, code: 'QAQC', name: 'QA / QC', isActive: true, isSystem: false },
    ],
  },

  // ── Group Mapping ───────────────────────────────────────────────────────────
  {
    name: 'putDepartments',
    status: 200,
    answer: f.departmentMappings,
    call: (a) => a.groups.putDepartments([{ groupName: 'eng', departmentId: f.D1 }]),
    sent: `PUT ${T}/group-mappings/departments`,
    body: { mappings: [{ keycloak_group_name: 'eng', department_id: f.D1 }] },
    returns: [{ groupName: 'eng', departmentId: f.D1 }],
  },
  {
    name: 'putLevels (the level is `role_code` on the wire)',
    status: 200,
    answer: f.levelMappings,
    call: (a) => a.groups.putLevels([{ groupName: 'eng', level: 'reviewer' }]),
    sent: `PUT ${T}/group-mappings/department-roles`,
    body: { mappings: [{ keycloak_group_name: 'eng', role_code: 'reviewer' }] },
    returns: [{ groupName: 'eng', level: 'reviewer' }],
  },
  {
    name: 'putTenantRoles',
    status: 200,
    answer: f.tenantRoleMappings,
    call: (a) => a.groups.putTenantRoles([{ groupName: 'admins', role: 'tenant_admin' }]),
    sent: `PUT ${T}/group-mappings/tenant-roles`,
    body: { mappings: [{ keycloak_group_name: 'admins', role_code: 'tenant_admin' }] },
    returns: [{ groupName: 'admins', role: 'tenant_admin' }],
  },
  {
    name: 'putDepartments with an empty list (deletes every row)',
    status: 200,
    answer: { mappings: [] },
    call: (a) => a.groups.putDepartments([]),
    sent: `PUT ${T}/group-mappings/departments`,
    body: { mappings: [] },
    returns: [],
  },

  // ── Audit Log ───────────────────────────────────────────────────────────────
  {
    name: 'search (200: a page, with the plan window clamp)',
    status: 200,
    answer: f.auditPage,
    call: (a) => a.audit.search({ entryTypes: ['membership.suspended'], from: '2025-01-01T00:00:00Z', actorType: 'user', retentionTier: 'security_3y' }, { limit: 100 }),
    sent: 'GET /api/v1/audit/events',
    query: [['limit', '100'], ['from', '2025-01-01T00:00:00Z'], ['entry_type', 'membership.suspended'], ['actor_type', 'user'], ['retention_tier', 'security_3y']],
    returns: {
      kind: 'page',
      page: {
        entries: [
          {
            id: 'ev-1',
            occurredAt: f.AT,
            actor: { type: 'user', display: 'Ada Lovelace', id: f.U1 },
            action: 'member.suspended',
            entryType: 'membership.suspended',
            target: { type: 'member', id: f.U2 },
            sourceService: 'iam-org-membership',
            retentionTier: 'security_3y',
            ipAddress: '203.0.113.7',
            traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
            metadata: { reason: 'left the company' },
          },
        ],
        nextCursor: parseCursor('eyJ0IjoxfQ=='),
        windowClamped: true,
        effectiveFrom: '2025-11-25T00:00:00Z',
      },
    },
  },
  {
    name: 'search (202: a large search answers an export job)',
    status: 202,
    answer: f.exportAccepted,
    call: (a) => a.audit.search({ entryTypes: [] }, { limit: 100 }),
    sent: 'GET /api/v1/audit/events',
    query: [['limit', '100']],
    returns: { kind: 'export', job: { exportId: 'ex-1', status: 'pending' } },
  },
  {
    name: 'getEntry',
    status: 200,
    answer: f.auditEvent,
    call: async (a) => (await a.audit.getEntry('ev-1')).entryType,
    sent: 'GET /api/v1/audit/events/ev-1',
    returns: 'membership.suspended',
  },
  {
    name: 'requestExport (several entry types are fine in a JSON body)',
    status: 202,
    answer: f.exportAccepted,
    call: (a) => a.audit.requestExport({ entryTypes: ['auth.login', 'membership.added'], from: '2026-01-01T00:00:00Z', actorType: 'service_account' }),
    sent: 'POST /api/v1/audit/exports',
    body: { from: '2026-01-01T00:00:00Z', entry_type: ['auth.login', 'membership.added'], actor_type: 'service_account' },
    returns: { exportId: 'ex-1', status: 'pending' },
  },
  {
    name: 'requestExport with no filter (the body is optional)',
    status: 202,
    answer: f.exportAccepted,
    call: (a) => a.audit.requestExport({ entryTypes: [] }),
    sent: 'POST /api/v1/audit/exports',
    body: {},
    returns: { exportId: 'ex-1', status: 'pending' },
  },
  {
    name: 'getExport (ready: a fresh download URL)',
    status: 200,
    answer: f.exportReady,
    call: (a) => a.audit.getExport('ex-1'),
    sent: 'GET /api/v1/audit/exports/ex-1',
    returns: { exportId: 'ex-1', status: 'ready', createdAt: f.AT, completedAt: '2026-11-25T10:02:00Z', rowCount: 1200, downloadUrl: 'https://files.example.com/ex-1.csv?sig=abc', downloadUrlExpiresAt: '2026-11-25T10:17:00Z', expiresAt: '2026-12-02T10:02:00Z' },
  },
  {
    name: 'getExport (failed: the reason)',
    status: 200,
    answer: f.exportFailed,
    call: (a) => a.audit.getExport('ex-2'),
    sent: 'GET /api/v1/audit/exports/ex-2',
    returns: { exportId: 'ex-2', status: 'failed', createdAt: f.AT, error: 'archive unavailable' },
  },

  // ── Delegation policy ───────────────────────────────────────────────────────
  {
    name: 'delegation policy get (no tenant ID in the path: the gateway injects it)',
    status: 200,
    answer: f.delegationSettings,
    call: (a) => a.delegation.get(),
    sent: 'GET /api/v1/delegations/settings',
    returns: { maxDurationDays: 90, reviewWindowDays: 60 },
  },
  {
    name: 'delegation policy put',
    status: 200,
    answer: { ...f.delegationSettings, max_duration_days: 30 },
    call: (a) => a.delegation.put({ maxDurationDays: 30, reviewWindowDays: 60 }),
    sent: 'PUT /api/v1/delegations/settings',
    body: { max_duration_days: 30, review_window_days: 60 },
    returns: { maxDurationDays: 30, reviewWindowDays: 60 },
  },
]

describe('every adapter call conforms to the pinned IAM Swagger', () => {
  it.each(cases)('$name', async (c) => {
    const server = stubServer()
    server.reply(c.status, c.answer)
    const result = await c.call(adapters())

    expect(server.calls).toHaveLength(1)
    const call = server.calls[0]!
    expect(`${call.method} ${call.pathname}`).toBe(c.sent)
    if (c.query) expect(call.query).toEqual(c.query)
    else expect(call.query).toEqual([])
    if (c.body !== undefined) expect(call.body).toEqual(c.body)

    const verdict = conformance(call, { status: c.status, ...(c.answer !== undefined ? { body: c.answer } : {}) })
    expect(verdict.problems, `${verdict.service} ${verdict.swaggerPath}`).toEqual([])
    if (c.returns !== undefined || c.status === 204) expect(result).toEqual(c.returns)
  })

  it('has a case for every method of every adapter: nothing the adapters can send is untested', () => {
    const all = makeAdapters((name, port) => port)
    const methods = Object.entries(all).flatMap(([name, port]) => Object.keys(port).map((m) => `${name}.${m}`))
    expect(methods.length).toBeGreaterThan(30)
    // getAll of the group-mapping adapter reads three lists in one call; it has its own test below.
    expect(methods.filter((m) => !called.has(m) && m !== 'groups.getAll')).toEqual([])
  })
})

describe('group mappings getAll', () => {
  it('reads the three lists and returns them together', async () => {
    const server = stubServer()
    server.reply(200, f.departmentMappings)
    server.reply(200, f.levelMappings)
    server.reply(200, f.tenantRoleMappings)
    const result = await adapters().groups.getAll()
    expect(server.calls.map((c) => `${c.method} ${c.pathname}`).sort()).toEqual([
      `GET ${T}/group-mappings/department-roles`,
      `GET ${T}/group-mappings/departments`,
      `GET ${T}/group-mappings/tenant-roles`,
    ])
    for (const call of server.calls) expect(conformance(call, { status: 200, body: {} }).problems.filter((p) => !p.startsWith('answer'))).toEqual([])
    expect(result.departments).toEqual([{ groupName: 'eng', departmentId: f.D1 }])
    expect(result.levels).toEqual([{ groupName: 'eng', level: 'reviewer' }])
    expect(result.tenantRoles).toEqual([{ groupName: 'admins', role: 'tenant_admin' }])
  })
})

describe('the percent-encoded custom method', () => {
  it('sends users%3Abatch, which a server that decodes the path before routing serves as /users:batch', async () => {
    const server = stubServer()
    server.reply(200, { users: [], missing: [] })
    await adapters().users.batch([f.U1])
    expect(server.calls[0]!.rawPath).toBe('/api/v1/users%3Abatch')
    expect(server.calls[0]!.pathname).toBe('/api/v1/users:batch')
  })
})

describe('no identity on the wire (IAM-UX-1)', () => {
  it('sends no tenant, user or role in a body or a query, only the tenant ID in the path', async () => {
    const server = stubServer()
    server.reply(202, f.invitationItem)
    await adapters().org.invite({ email: 'a@b.co', fullName: 'A', initialTenantRoles: [], initialDeptMappings: [] })
    const wire = JSON.stringify([server.calls[0]!.body, server.calls[0]!.query])
    expect(wire).not.toMatch(/tenant_id|x-user-id|x-tenant/)
  })
})
