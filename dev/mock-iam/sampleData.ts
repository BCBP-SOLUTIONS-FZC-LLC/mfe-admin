// DEV ONLY: a realistic workspace for looking at the admin screens with data, as the IAM services would
// answer it (the fake IAM's own state shapes, snake_case like the Swagger). Nothing here ships: it is
// used by dev/mock-iam/server.ts only.
import type { FakeIamCore } from '../../test/fixtures/fakeIamCore.ts'

type Json = Record<string, unknown>
const day = (n: number) => new Date(Date.UTC(2026, 10, 25) + n * 86_400_000).toISOString()

const PEOPLE: {
  id: string
  name: string
  title?: string
  source: 'local' | 'federated'
  availability?: 'available' | 'busy' | 'ooo'
  roles: string[]
  depts: [string, 'preparator' | 'reviewer' | 'approver'][]
  status?: 'active' | 'suspended'
  profileStatus?: 'active' | 'disabled'
}[] = [
  { id: 'u-ada', name: 'Ada Lovelace', title: 'Managing Director', source: 'federated', availability: 'available', roles: ['tenant_owner'], depts: [['d-eng', 'approver']] },
  { id: 'u-omar', name: 'Omar Al-Farsi', title: 'Head of Tendering', source: 'federated', availability: 'busy', roles: ['tenant_admin'], depts: [['d-eng', 'approver'], ['d-plan', 'reviewer']] },
  { id: 'u-priya', name: 'Priya Nair', title: 'Bid Manager', source: 'local', availability: 'available', roles: ['tender_admin'], depts: [['d-proc', 'approver']] },
  { id: 'u-bob', name: 'Bob Builder', title: 'Chief Estimator', source: 'local', availability: 'ooo', roles: ['tender_admin'], depts: [['d-qa', 'reviewer'], ['d-eng', 'preparator']] },
  { id: 'u-sara', name: 'Sara Haddad', title: 'Procurement Lead', source: 'federated', availability: 'available', roles: [], depts: [['d-proc', 'reviewer']] },
  { id: 'u-liam', name: "Liam O'Connor", title: 'HSE Officer', source: 'local', availability: 'busy', roles: [], depts: [['d-hse', 'approver']] },
  { id: 'u-mei', name: 'Mei Chen', title: 'Planner', source: 'federated', availability: 'available', roles: [], depts: [['d-plan', 'preparator']] },
  { id: 'u-jon', name: 'Jon Weber', title: 'QA Engineer', source: 'local', availability: 'available', roles: [], depts: [['d-qa', 'preparator'], ['d-hse', 'preparator']] },
  { id: 'u-nadia', name: 'Nadia Karim', title: 'Legal Counsel', source: 'federated', availability: 'ooo', roles: [], depts: [['d-legal', 'reviewer']] },
  { id: 'u-tom', name: 'Tom Alvarez', title: 'Junior Estimator', source: 'local', roles: [], depts: [['d-eng', 'preparator']], status: 'suspended' },
  { id: 'u-yuki', name: 'Yuki Tanaka', title: 'Cost Engineer', source: 'federated', availability: 'available', roles: [], depts: [['d-eng', 'reviewer']] },
  { id: 'u-fatima', name: 'Fatima Zahra', source: 'local', availability: 'busy', roles: [], depts: [], profileStatus: 'disabled' },
  { id: 'u-ivan', name: 'Ivan Petrov', title: 'Site Engineer', source: 'local', availability: 'available', roles: [], depts: [['d-qa', 'preparator']] },
  { id: 'u-grace', name: 'Grace Okafor', title: 'Commercial Manager', source: 'federated', availability: 'available', roles: ['tender_admin'], depts: [['d-proc', 'reviewer'], ['d-legal', 'preparator']] },
]

/** Export jobs the exports page lists (ids kept in the SDK's per-app storage by the harness): one ready, one preparing, one waiting. */
export const SAMPLE_EXPORT_IDS = ['ex-ready', 'ex-running', 'ex-waiting'] as const

export function seedSampleWorkspace(iam: FakeIamCore): void {
  const s = iam.state
  s.tenant = { ...s.tenant, name: 'Acme Construction', slug: 'bcbp', plan: 'enterprise', licensed_seats: 20, record_version: 4 }

  s.members = PEOPLE.map((p, i) => ({
    user_id: p.id,
    status: p.status ?? 'active',
    tenant_roles: p.roles,
    departments: p.depts.map(([department_id, level]) => ({ department_id, level })),
    record_version: i + 1,
  }))
  s.profiles = Object.fromEntries(
    PEOPLE.map((p, i) => [
      p.id,
      {
        id: p.id,
        display_name: p.name,
        email: `${p.name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '')}@acme-construction.com`,
        ...(p.title ? { job_title: p.title } : {}),
        source: p.source,
        status: p.profileStatus ?? 'active',
        record_version: i + 2,
        ...(p.availability ? { availability: { status: p.availability } } : {}),
      },
    ]),
  )

  s.invitations = [
    { invitation_id: 'inv-1', email: 'rashid.m@acme-construction.com', full_name: 'Rashid Mansour', initial_tenant_roles: ['tender_admin'], invited_by: 'u-omar', created_at: day(-2), expires_at: day(5), record_version: 1, status: 'pending' },
    { invitation_id: 'inv-2', email: 'elena.v@acme-construction.com', full_name: 'Elena Vasquez', initial_tenant_roles: [], invited_by: 'u-ada', created_at: day(-5), expires_at: day(2), record_version: 1, status: 'pending' },
    { invitation_id: 'inv-3', email: 'kwame.a@acme-construction.com', full_name: 'Kwame Asante', initial_tenant_roles: ['tenant_admin'], invited_by: 'u-ada', created_at: day(-1), expires_at: day(6), record_version: 1, status: 'pending' },
  ]

  const dept = (id: string, code: string, name: string, system = false, active = true, v = 1): Json => ({ department_id: id, code, name, is_active: active, is_system: system, record_version: v })
  s.departments = [
    dept('d-eng', 'ENG', 'Engineering', true),
    dept('d-qa', 'QAQC', 'QA / QC', false, true, 2),
    dept('d-hse', 'HSE', 'Health, Safety & Environment', false, true, 3),
    dept('d-proc', 'PROC', 'Procurement', false, true, 2),
    dept('d-plan', 'PLAN', 'Planning', false, true, 4),
    dept('d-legal', 'LEGAL', 'Legal & Contracts', false, true, 2),
    dept('d-fin', 'FIN', 'Finance', false, false, 5),
  ]
  s.catalog = [
    ...(s.departments as Json[]).map((d) => ({ id: d['department_id'], code: d['code'], name: d['name'], is_active: true, is_system: d['is_system'], record_version: 1 })),
    { id: 'd-comm', code: 'COMM', name: 'Commercial', is_active: true, is_system: false, record_version: 1 },
    { id: 'd-it', code: 'IT', name: 'Information Technology', is_active: true, is_system: false, record_version: 1 },
    { id: 'd-hr', code: 'HR', name: 'People & Culture', is_active: true, is_system: false, record_version: 1 },
  ]
  s.labels = [
    { role_code: 'preparator', display_name: 'Engineer', record_version: 2 },
    { role_code: 'reviewer', display_name: 'Manager', record_version: 3 },
    { role_code: 'approver', display_name: 'Director', record_version: 2 },
  ]

  s.mappings = {
    departments: [
      { keycloak_group_name: 'acme-engineering', department_id: 'd-eng' },
      { keycloak_group_name: 'acme-procurement', department_id: 'd-proc' },
      { keycloak_group_name: 'acme-hse', department_id: 'd-hse' },
    ],
    levels: [
      { keycloak_group_name: 'acme-engineering', role_code: 'reviewer' },
      { keycloak_group_name: 'acme-procurement', role_code: 'approver' },
      { keycloak_group_name: 'acme-hse', role_code: 'preparator' },
      // A level without a department: the screen marks the row incomplete.
      { keycloak_group_name: 'acme-leads', role_code: 'reviewer' },
    ],
    tenantRoles: [
      { keycloak_group_name: 'acme-it-admins', role_code: 'tenant_admin' },
      { keycloak_group_name: 'acme-owners', role_code: 'tenant_owner' },
    ],
  }

  const who = (id: string) => ({ id, type: 'user', display: PEOPLE.find((p) => p.id === id)?.name ?? id })
  const ev = (n: number, at: number, actor: string, action: string, type: string, target: Json, metadata: Json = {}): Json => ({
    id: `ev-${n}`, occurred_at: day(at), actor: who(actor), action, entry_type: type, target, source_service: 'iam-org-membership', metadata,
  })
  s.audit = [
    ev(1, -0.1, 'u-ada', 'member.invited', 'invitation.created', { type: 'invitation', id: 'inv-3' }, { email: 'kwame.a@acme-construction.com' }),
    ev(2, -1, 'u-omar', 'member.invited', 'invitation.created', { type: 'invitation', id: 'inv-1' }, { email: 'rashid.m@acme-construction.com' }),
    ev(3, -2, 'u-ada', 'member.suspended', 'membership.suspended', { type: 'member', id: 'u-tom' }, { reason: 'left the company' }),
    ev(4, -3, 'u-omar', 'roles.changed', 'membership.roles_changed', { type: 'member', id: 'u-grace' }, { added: ['tender_admin'] }),
    ev(5, -4, 'u-ada', 'config.department.activated', 'config.department.activated', { type: 'department', id: 'd-legal' }),
    ev(6, -6, 'u-ada', 'settings.updated', 'config.tenant_setting.changed', { type: 'tenant', id: 'tenant-1' }, { changed: ['default_locale'] }),
    ev(7, -7, 'u-omar', 'member.department_assigned', 'membership.department_assigned', { type: 'member', id: 'u-yuki' }, { department: 'Engineering', level: 'reviewer' }),
    ev(8, -9, 'u-ada', 'config.department.retired', 'config.department.retired', { type: 'department', id: 'd-fin' }),
    ev(9, -12, 'u-omar', 'role_label.renamed', 'config.role_label.changed', { type: 'role_label', id: 'reviewer' }, { from: 'Lead', to: 'Manager' }),
    ev(10, -15, 'u-ada', 'config.group_mapping.saved', 'config.group_mapping.saved', { type: 'group_mapping', id: 'departments' }),
  ]
  s.audit.push(
    { ...ev(11, -0.5, 'u-bob', 'login.success', 'auth.login.success', { type: 'session', id: 's-7' }, {}), ip_address: '203.0.113.24', trace_id: '4bf92f3577b34da6a3ce929d0e0e4736', retention_tier: 'access_90d' },
    { ...ev(12, -8, 'u-ada', 'delegation.policy_updated', 'delegation.policy_updated', { type: 'tenant', id: 'tenant-1' }, { max_duration_days: 60 }), ip_address: '198.51.100.9', trace_id: 'c8d1b4aa6f2e4c1f9d7e3b2a1f0e9d8c', retention_tier: 'compliance_7y' },
  )
  s.exports.set('ex-ready', { polls: 5 })
  s.exports.set('ex-running', { polls: 1 })
  s.exports.set('ex-waiting', { polls: 0 })
  s.delegation = { max_duration_days: 60, review_window_days: 30, record_version: 3 }
}
