// Answers as the IAM services send them (snake_case), written against the pinned Swagger: the contract
// test checks each one validates, with no field the Swagger does not declare, before an adapter reads it.
export const U1 = '11111111-1111-4111-8111-111111111111'
export const U2 = '11111111-1111-4111-8111-222222222222'
export const D1 = '22222222-2222-4222-8222-111111111111'
export const D2 = '22222222-2222-4222-8222-222222222222'
export const INV = '33333333-3333-4333-8333-111111111111'
export const AT = '2026-11-25T10:00:00Z'

export const tenant = {
  id: '6f1c2a9e-3b4d-4e5f-8a7b-9c0d1e2f3a4b',
  name: 'Acme',
  slug: 'acme',
  default_locale: 'en',
  mfa_freshness_seconds: 300,
  local_accounts_enabled: true,
  residency_mode: 'standard',
  record_version: 7,
  status: 'active',
  plan: 'pro',
  licensed_seats: 10,
  realm_sync_pending: false,
  updated_at: AT,
}

export const departmentList = {
  items: [
    { department_id: D1, code: 'ENG', name: 'Engineering', is_active: true, is_system: true, record_version: 1 },
    { department_id: D2, code: 'QAQC', name: 'QA / QC', is_active: false, is_system: false, record_version: 4 },
  ],
}
export const departmentVersion = { department_id: D2, is_active: true, record_version: 5 }
export const departmentMembers = { items: [{ user_id: U1, level: 'approver' }, { user_id: U2, level: 'preparator' }] }
export const departmentAssigned = { department_id: D1, level: 'reviewer', record_version: 2, user_id: U1 }
export const departmentRemoved = { department_id: D1, removed: true, user_id: U1 }

export const memberItem = {
  user_id: U1,
  status: 'active',
  tenant_roles: ['tenant_admin', 'tender_admin'],
  departments: [{ department_id: D1, level: 'reviewer' }],
  record_version: 3,
  updated_at: AT,
}
export const memberPage = { items: [memberItem, { ...memberItem, user_id: U2, status: 'suspended', tenant_roles: [], departments: [] }], next_cursor: 'eyJpZCI6Mn0=' }

/** `id` is the older alias, still sent beside `invitation_id`; the adapter must read only `invitation_id`. */
export const invitationItem = {
  id: 'legacy-alias-not-read',
  invitation_id: INV,
  email: 'ada@example.com',
  full_name: 'Ada Lovelace',
  initial_tenant_roles: ['tender_admin'],
  invited_by: U1,
  created_at: AT,
  expires_at: '2026-12-02T10:00:00Z',
  record_version: 1,
  status: 'pending',
}
export const invitationList = { items: [invitationItem] }

export const statusPatched = { user_id: U2, status: 'suspended', record_version: 4, updated_at: AT }
export const rolesReplaced = { user_id: U1, roles: ['tender_admin'] }
export const seatUsage = { active_users: 3, pending_invitations: 1, licensed_seats: 10 }
export const roleLabels = {
  items: [
    { role_code: 'preparator', display_name: 'Engineer', record_version: 1 },
    { role_code: 'reviewer', display_name: 'Manager', record_version: 2 },
    { role_code: 'approver', display_name: 'Director', record_version: 1 },
  ],
}
export const roleLabelRenamed = { role_code: 'approver', display_name: 'Head', record_version: 2 }

export const userProfile = {
  id: U1,
  display_name: 'Ada Lovelace',
  email: 'ada@example.com',
  job_title: 'Chief Engineer',
  locale: 'en',
  timezone: 'Europe/London',
  source: 'federated',
  status: 'active',
  provisional: false,
  record_version: 2,
  tenant_id: '6f1c2a9e-3b4d-4e5f-8a7b-9c0d1e2f3a4b',
  username: 'ada',
  availability: { status: 'ooo' },
  created_at: AT,
  updated_at: AT,
}
export const userBatch = { users: [userProfile], missing: [U2], pagination: { limit: 2, total: 1 } }

export const catalog = {
  items: [
    { id: D1, code: 'ENG', name: 'Engineering', is_active: true, is_system: true, record_version: 1 },
    { id: D2, code: 'QAQC', name: 'QA / QC', is_active: true, is_system: false, record_version: 1 },
  ],
}

const mapping = { id: 'm-1', tenant_id: '6f1c2a9e-3b4d-4e5f-8a7b-9c0d1e2f3a4b', record_version: 1, created_at: AT, updated_at: AT }
export const departmentMappings = { mappings: [{ ...mapping, keycloak_group_name: 'eng', department_id: D1 }] }
export const levelMappings = { mappings: [{ ...mapping, keycloak_group_name: 'eng', role_code: 'reviewer' }] }
export const tenantRoleMappings = { mappings: [{ ...mapping, keycloak_group_name: 'admins', role_code: 'tenant_admin' }] }

export const auditEvent = {
  id: 'ev-1',
  occurred_at: AT,
  actor: { id: U1, type: 'user', display: 'Ada Lovelace' },
  action: 'member.suspended',
  entry_type: 'membership.suspended',
  target: { type: 'member', id: U2 },
  source_service: 'iam-org-membership',
  source_event_type: 'MemberSuspended',
  retention_tier: 'security_3y',
  ip_address: '203.0.113.7',
  trace_id: '4bf92f3577b34da6a3ce929d0e0e4736',
  metadata: { reason: 'left the company' },
}
export const auditPage = { events: [auditEvent], next_cursor: 'eyJ0IjoxfQ==', window_clamped: true, effective_from: '2025-11-25T00:00:00Z' }
export const exportAccepted = { export_id: 'ex-1', status: 'pending', status_url: '/api/v1/audit/exports/ex-1' }
export const exportReady = {
  export_id: 'ex-1',
  status: 'ready',
  created_at: AT,
  completed_at: '2026-11-25T10:02:00Z',
  row_count: 1200,
  download_url: 'https://files.example.com/ex-1.csv?sig=abc',
  download_url_expires_at: '2026-11-25T10:17:00Z',
  expires_at: '2026-12-02T10:02:00Z',
}
export const exportFailed = { export_id: 'ex-2', status: 'failed', created_at: AT, error: 'archive unavailable' }

export const delegationSettings = { max_duration_days: 90, review_window_days: 60, record_version: 2 }
