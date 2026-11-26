// A list the service answers as `null` or leaves out is an empty list (Go serialises a nil slice as
// null), never a failure. Service answers (snake_case JSON) to domain types, and domain values to request bodies. Pure:
// no HTTP here, so the contract tests can feed the Swagger-shaped fixtures straight in.
import type { AuditActor, AuditEntry, AuditExport, AuditExportAccepted, AuditExportStatus, AuditPage } from '../../domain/entities/audit'
import type { CatalogDepartment, DepartmentVersion, RoleLabel, TenantDepartment } from '../../domain/entities/department'
import type { DepartmentMapping, GroupMappings, LevelMapping, TenantRoleMapping } from '../../domain/entities/groupMapping'
import type { Invitation, InvitationRequest } from '../../domain/entities/invitation'
import type { DepartmentAssignment, DepartmentMemberRef, Member, MemberPage, MemberStatusChange, RemovalResolution, RolesChange } from '../../domain/entities/member'
import type { SeatUsage } from '../../domain/entities/seats'
import type { DelegationPolicy, Plan, SubscriptionStatus, TenantSettings, TenantSettingsPatch } from '../../domain/entities/settings'
import type { Availability, UserBatch, UserSummary } from '../../domain/entities/user'
import { ACTOR_TYPES, RETENTION_TIERS, type AuditFilter, type RetentionTier } from '../../domain/value-objects/AuditFilter'
import { parseCursor } from '../../domain/value-objects/Cursor'
import { recordVersion } from '../../domain/value-objects/RecordVersion'
import { DEPARTMENT_LEVELS, TENANT_ROLES, type TenantRole } from '../../domain/vocabulary'
import type { UserProfileEdit } from '../../domain/repositories/UserProfilePort'
import {
  MappingError,
  arrayOrEmpty,
  boolean,
  integer,
  object,
  oneOf,
  optBoolean,
  optInteger,
  optString,
  string,
  type Json,
} from './readers'

const version = (o: Json, key: string, path: string) => {
  try {
    return recordVersion(integer(o, key, path))
  } catch (e) {
    throw e instanceof MappingError ? e : new MappingError(`${path}.${key}`, 'a non-negative integer')
  }
}

/** Roles the UI knows. `member` is implicit and never stored; a code from a newer service is dropped, not shown raw. */
const roles = (v: unknown, path: string): TenantRole[] =>
  arrayOrEmpty(v, path).filter((r): r is TenantRole => (TENANT_ROLES as readonly unknown[]).includes(r))

// ── Org & Membership ───────────────────────────────────────────────────────────────────────────

const STATUSES: readonly SubscriptionStatus[] = ['trial', 'active', 'past_due', 'cancelled', 'suspended', 'trial_expired', 'offboarded']
const PLANS: readonly Plan[] = ['starter', 'pro', 'enterprise']

/** `GET /tenants/:id` and the answer of `PATCH /tenants/:id`. A `202` also means the realm part is still applying. */
export function toTenantSettings(body: unknown, accepted = false): TenantSettings {
  const o = object(body, 'tenant')
  return {
    name: string(o, 'name', 'tenant'),
    defaultLocale: string(o, 'default_locale', 'tenant'),
    mfaFreshnessSeconds: integer(o, 'mfa_freshness_seconds', 'tenant'),
    localAccountsEnabled: boolean(o, 'local_accounts_enabled', 'tenant'),
    residencyMode: o['residency_mode'] === 'strict' ? 'strict' : 'standard',
    recordVersion: version(o, 'record_version', 'tenant'),
    status: oneOf(o, 'status', STATUSES, 'tenant'),
    plan: oneOf(o, 'plan', PLANS, 'tenant'),
    realmSyncPending: accepted || optBoolean(o, 'realm_sync_pending') === true,
  }
}

export function toTenantPatchBody(p: TenantSettingsPatch): Json {
  return {
    ...(p.name !== undefined ? { name: p.name } : {}),
    ...(p.defaultLocale !== undefined ? { default_locale: p.defaultLocale } : {}),
    ...(p.mfaFreshnessSeconds !== undefined ? { mfa_freshness_seconds: p.mfaFreshnessSeconds } : {}),
    ...(p.localAccountsEnabled !== undefined ? { local_accounts_enabled: p.localAccountsEnabled } : {}),
    ...(p.residencyMode !== undefined ? { residency_mode: p.residencyMode } : {}),
    record_version: p.recordVersion,
  }
}

export function toTenantDepartments(body: unknown): TenantDepartment[] {
  return arrayOrEmpty(object(body, 'departments')['items'], 'departments.items').map((v, i) => {
    const path = `departments.items[${i}]`
    const o = object(v, path)
    return {
      departmentId: string(o, 'department_id', path),
      code: string(o, 'code', path),
      name: string(o, 'name', path),
      isActive: boolean(o, 'is_active', path),
      isSystem: boolean(o, 'is_system', path),
      recordVersion: version(o, 'record_version', path),
    }
  })
}

/** The answer of P-24 and P-25. */
export function toDepartmentVersion(body: unknown): DepartmentVersion {
  const o = object(body, 'department')
  return { departmentId: string(o, 'department_id', 'department'), isActive: boolean(o, 'is_active', 'department'), recordVersion: version(o, 'record_version', 'department') }
}

export function toDepartmentMembers(body: unknown): DepartmentMemberRef[] {
  return arrayOrEmpty(object(body, 'members')['items'], 'members.items').map((v, i) => {
    const path = `members.items[${i}]`
    const o = object(v, path)
    return { userId: string(o, 'user_id', path), level: oneOf(o, 'level', DEPARTMENT_LEVELS, path) }
  })
}

const assignments = (v: unknown, path: string): DepartmentAssignment[] =>
  arrayOrEmpty(v, path).map((d, i) => {
    const o = object(d, `${path}[${i}]`)
    return { departmentId: string(o, 'department_id', `${path}[${i}]`), level: oneOf(o, 'level', DEPARTMENT_LEVELS, `${path}[${i}]`) }
  })

/** One item of P-4, or the whole answer of P-5. */
export function toMember(body: unknown, path = 'member'): Member {
  const o = object(body, path)
  return {
    userId: string(o, 'user_id', path),
    status: oneOf(o, 'status', ['active', 'suspended'] as const, path),
    tenantRoles: roles(o['tenant_roles'], `${path}.tenant_roles`),
    departments: assignments(o['departments'], `${path}.departments`),
    recordVersion: version(o, 'record_version', path),
  }
}

export function toMemberPage(body: unknown): MemberPage {
  const o = object(body, 'members')
  const next = parseCursor(o['next_cursor'])
  return {
    members: arrayOrEmpty(o['items'], 'members.items').map((m, i) => toMember(m, `members.items[${i}]`)),
    ...(next ? { nextCursor: next } : {}),
  }
}

export function toInvitation(body: unknown, path = 'invitation'): Invitation {
  const o = object(body, path)
  return {
    // `invitation_id`: the older `id` alias is being removed and is never read (spec §11.1).
    invitationId: string(o, 'invitation_id', path),
    email: string(o, 'email', path),
    fullName: string(o, 'full_name', path),
    initialRoles: roles(o['initial_tenant_roles'], `${path}.initial_tenant_roles`),
    invitedBy: string(o, 'invited_by', path),
    sentAt: string(o, 'created_at', path),
    expiresAt: string(o, 'expires_at', path),
    recordVersion: version(o, 'record_version', path),
  }
}

export function toInvitations(body: unknown): Invitation[] {
  return arrayOrEmpty(object(body, 'invitations')['items'], 'invitations.items').map((v, i) => toInvitation(v, `invitations.items[${i}]`))
}

export function toInvitationBody(r: InvitationRequest): Json {
  return {
    email: r.email,
    full_name: r.fullName,
    initial_tenant_roles: [...r.initialTenantRoles],
    initial_dept_mappings: r.initialDeptMappings.map((d) => ({ department_id: d.departmentId, level: d.level })),
  }
}

export function toMemberStatusChange(body: unknown): MemberStatusChange {
  const o = object(body, 'membership')
  return {
    userId: string(o, 'user_id', 'membership'),
    status: oneOf(o, 'status', ['active', 'suspended'] as const, 'membership'),
    recordVersion: version(o, 'record_version', 'membership'),
  }
}

export function toRolesChange(body: unknown): RolesChange {
  const o = object(body, 'roles')
  return { userId: string(o, 'user_id', 'roles'), roles: roles(o['roles'], 'rolesChange.items') }
}

export function toResolutionBody(r: RemovalResolution): Json {
  return r.action === 'replace_delegate' ? { action: r.action, replacement_user_id: r.replacementUserId } : { action: r.action }
}

export function toSeatUsage(body: unknown): SeatUsage {
  const o = object(body, 'seats')
  return {
    activeUsers: integer(o, 'active_users', 'seats'),
    pendingInvitations: integer(o, 'pending_invitations', 'seats'),
    licensedSeats: integer(o, 'licensed_seats', 'seats'),
  }
}

export function toRoleLabels(body: unknown): RoleLabel[] {
  return arrayOrEmpty(object(body, 'roleLabels')['items'], 'roleLabels.items').map((v, i) => toRoleLabel(v, `roleLabels.items[${i}]`))
}

export function toRoleLabel(body: unknown, path = 'roleLabel'): RoleLabel {
  const o = object(body, path)
  return { roleCode: oneOf(o, 'role_code', DEPARTMENT_LEVELS, path), displayName: string(o, 'display_name', path), recordVersion: version(o, 'record_version', path) }
}

// ── User Profile ───────────────────────────────────────────────────────────────────────────────

export function toUser(body: unknown, path = 'user'): UserSummary {
  const o = object(body, path)
  const availability = o['availability'] === undefined || o['availability'] === null ? undefined : object(o['availability'], `${path}.availability`)
  const status = availability ? optString(availability, 'status') : undefined
  const known: readonly Availability[] = ['available', 'busy', 'ooo']
  const a = known.find((x) => x === status)
  const job = optString(o, 'job_title')
  return {
    userId: string(o, 'id', path),
    displayName: string(o, 'display_name', path),
    email: string(o, 'email', path),
    ...(job ? { jobTitle: job } : {}),
    source: oneOf(o, 'source', ['local', 'federated'] as const, path),
    status: oneOf(o, 'status', ['active', 'disabled', 'deleted'] as const, path),
    ...(a ? { availability: a } : {}),
    provisional: optBoolean(o, 'provisional') === true,
    ...(optBoolean(o, 'display_name_overridden') !== undefined ? { displayNameOverridden: optBoolean(o, 'display_name_overridden')! } : {}),
    ...(optBoolean(o, 'job_title_overridden') !== undefined ? { jobTitleOverridden: optBoolean(o, 'job_title_overridden')! } : {}),
    recordVersion: version(o, 'record_version', path),
  }
}

export function toUserBatch(body: unknown): UserBatch {
  const o = object(body, 'batch')
  return {
    users: arrayOrEmpty(o['users'], 'batch.users').map((u, i) => toUser(u, `batch.users[${i}]`)),
    missing: arrayOrEmpty(o['missing'], 'batch.missing').map((id, i) => {
      if (typeof id !== 'string') throw new MappingError(`batch.missing[${i}]`, 'a string')
      return id
    }),
  }
}

export function toUserEditBody(e: UserProfileEdit): Json {
  return {
    ...(e.revertDisplayName ? { display_name_overridden: false } : e.displayName !== undefined ? { display_name: e.displayName } : {}),
    ...(e.revertJobTitle ? { job_title_overridden: false } : e.jobTitle !== undefined ? { job_title: e.jobTitle } : {}),
    ...(e.phone !== undefined ? { phone: e.phone } : {}),
    ...(e.timezone !== undefined ? { timezone: e.timezone } : {}),
    ...(e.locale !== undefined ? { locale: e.locale } : {}),
    expected_version: e.expectedVersion,
  }
}

// ── Catalog ────────────────────────────────────────────────────────────────────────────────────

export function toCatalog(body: unknown): CatalogDepartment[] {
  return arrayOrEmpty(object(body, 'catalog')['items'], 'catalog.items').map((v, i) => {
    const path = `catalog.items[${i}]`
    const o = object(v, path)
    // The catalogue names its ID `id`, where the tenant's department list says `department_id`.
    return { departmentId: string(o, 'id', path), code: string(o, 'code', path), name: string(o, 'name', path), isActive: boolean(o, 'is_active', path), isSystem: boolean(o, 'is_system', path) }
  })
}

// ── Group Mapping ──────────────────────────────────────────────────────────────────────────────

const listOf = (body: unknown, what: string) => arrayOrEmpty(object(body, what)['mappings'], `${what}.mappings`)

export function toDepartmentMappings(body: unknown): DepartmentMapping[] {
  return listOf(body, 'departmentMappings').map((v, i) => {
    const o = object(v, `departmentMappings.mappings[${i}]`)
    return { groupName: string(o, 'keycloak_group_name', 'departmentMappings'), departmentId: string(o, 'department_id', 'departmentMappings') }
  })
}

export function toLevelMappings(body: unknown): LevelMapping[] {
  return listOf(body, 'levelMappings').map((v, i) => {
    const o = object(v, `levelMappings.mappings[${i}]`)
    return { groupName: string(o, 'keycloak_group_name', 'levelMappings'), level: oneOf(o, 'role_code', DEPARTMENT_LEVELS, 'levelMappings') }
  })
}

export function toTenantRoleMappings(body: unknown): TenantRoleMapping[] {
  return listOf(body, 'tenantRoleMappings').map((v, i) => {
    const o = object(v, `tenantRoleMappings.mappings[${i}]`)
    return { groupName: string(o, 'keycloak_group_name', 'tenantRoleMappings'), role: oneOf(o, 'role_code', TENANT_ROLES, 'tenantRoleMappings') }
  })
}

export const toDepartmentMappingsBody = (m: readonly DepartmentMapping[]): Json => ({ mappings: m.map((x) => ({ keycloak_group_name: x.groupName, department_id: x.departmentId })) })
export const toLevelMappingsBody = (m: readonly LevelMapping[]): Json => ({ mappings: m.map((x) => ({ keycloak_group_name: x.groupName, role_code: x.level })) })
export const toTenantRoleMappingsBody = (m: readonly TenantRoleMapping[]): Json => ({ mappings: m.map((x) => ({ keycloak_group_name: x.groupName, role_code: x.role })) })

export function emptyGroupMappings(): GroupMappings {
  return { departments: [], levels: [], tenantRoles: [] }
}

// ── Delegation policy ──────────────────────────────────────────────────────────────────────────

export function toDelegationPolicy(body: unknown): DelegationPolicy {
  const o = object(body, 'delegationPolicy')
  return { maxDurationDays: integer(o, 'max_duration_days', 'delegationPolicy'), reviewWindowDays: integer(o, 'review_window_days', 'delegationPolicy') }
}

export const toDelegationPolicyBody = (p: DelegationPolicy): Json => ({ max_duration_days: p.maxDurationDays, review_window_days: p.reviewWindowDays })

// ── Audit ──────────────────────────────────────────────────────────────────────────────────────

export function toAuditEntry(body: unknown, path = 'audit'): AuditEntry {
  const o = object(body, path)
  const actor = object(o['actor'], `${path}.actor`)
  const target = o['target'] === undefined || o['target'] === null ? undefined : object(o['target'], `${path}.target`)
  const tier = optString(o, 'retention_tier')
  const retentionTier: RetentionTier | undefined = RETENTION_TIERS.find((t) => t === tier)
  const actorId = optString(actor, 'id')
  const display = optString(actor, 'display')
  const targetType = target ? optString(target, 'type') : undefined
  const targetId = target ? optString(target, 'id') : undefined
  const ip = optString(o, 'ip_address')
  const trace = optString(o, 'trace_id')
  const meta = o['metadata'] === undefined || o['metadata'] === null ? {} : object(o['metadata'], `${path}.metadata`)
  const a: AuditActor = { type: oneOf(actor, 'type', ACTOR_TYPES, `${path}.actor`), ...(display ? { display } : {}), ...(actorId ? { id: actorId } : {}) }
  return {
    id: string(o, 'id', path),
    occurredAt: string(o, 'occurred_at', path),
    actor: a,
    action: string(o, 'action', path),
    entryType: string(o, 'entry_type', path),
    ...(targetType || targetId ? { target: { ...(targetType ? { type: targetType } : {}), ...(targetId ? { id: targetId } : {}) } } : {}),
    sourceService: string(o, 'source_service', path),
    ...(retentionTier ? { retentionTier } : {}),
    ...(ip ? { ipAddress: ip } : {}),
    ...(trace ? { traceId: trace } : {}),
    metadata: meta,
  }
}

export function toAuditPage(body: unknown): AuditPage {
  const o = object(body, 'auditPage')
  const next = parseCursor(o['next_cursor'])
  const from = optString(o, 'effective_from')
  return {
    entries: arrayOrEmpty(o['events'], 'auditPage.events').map((e, i) => toAuditEntry(e, `auditPage.events[${i}]`)),
    ...(next ? { nextCursor: next } : {}),
    windowClamped: optBoolean(o, 'window_clamped') === true,
    ...(from ? { effectiveFrom: from } : {}),
  }
}

const EXPORT_STATUSES: readonly AuditExportStatus[] = ['pending', 'running', 'ready', 'failed', 'expired']

/** `202` of a search or an export request: `export_id` and `status`. */
export function toAuditExportAccepted(body: unknown): AuditExportAccepted {
  const o = object(body, 'auditExport')
  return { exportId: string(o, 'export_id', 'auditExport'), status: oneOf(o, 'status', EXPORT_STATUSES, 'auditExport') }
}

export function toAuditExport(body: unknown): AuditExport {
  const o = object(body, 'auditExport')
  const text = (key: string) => optString(o, key)
  const created = text('created_at')
  const completed = text('completed_at')
  const rows = optInteger(o, 'row_count')
  const url = text('download_url')
  const urlExpires = text('download_url_expires_at')
  const expires = text('expires_at')
  const error = text('error')
  return {
    exportId: string(o, 'export_id', 'auditExport'),
    status: oneOf(o, 'status', EXPORT_STATUSES, 'auditExport'),
    ...(created ? { createdAt: created } : {}),
    ...(completed ? { completedAt: completed } : {}),
    ...(rows !== undefined ? { rowCount: rows } : {}),
    ...(url ? { downloadUrl: url } : {}),
    ...(urlExpires ? { downloadUrlExpiresAt: urlExpires } : {}),
    ...(expires ? { expiresAt: expires } : {}),
    ...(error ? { error } : {}),
  }
}

/** The search's query string: scalar keys only (see MAX_SEARCH_ENTRY_TYPES for why one entry type). */
export function toAuditQuery(filter: AuditFilter, limit: number, cursor?: string): Record<string, string | number> {
  const q: Record<string, string | number> = { limit }
  if (filter.from) q['from'] = filter.from
  if (filter.to) q['to'] = filter.to
  if (filter.entryTypes[0]) q['entry_type'] = filter.entryTypes[0]
  if (filter.actorId) q['actor_id'] = filter.actorId
  if (filter.actorType) q['actor_type'] = filter.actorType
  if (filter.targetType) q['target_type'] = filter.targetType
  if (filter.targetId) q['target_id'] = filter.targetId
  if (filter.sourceService) q['source_service'] = filter.sourceService
  if (filter.retentionTier) q['retention_tier'] = filter.retentionTier
  if (cursor) q['cursor'] = cursor
  return q
}

/** An export takes a JSON body, so several entry types are fine here. */
export function toAuditExportBody(filter: AuditFilter): Json {
  return {
    ...(filter.from ? { from: filter.from } : {}),
    ...(filter.to ? { to: filter.to } : {}),
    ...(filter.entryTypes.length > 0 ? { entry_type: [...filter.entryTypes] } : {}),
    ...(filter.actorId ? { actor_id: filter.actorId } : {}),
    ...(filter.actorType ? { actor_type: filter.actorType } : {}),
    ...(filter.targetType ? { target_type: filter.targetType } : {}),
    ...(filter.targetId ? { target_id: filter.targetId } : {}),
    ...(filter.sourceService ? { source_service: filter.sourceService } : {}),
    ...(filter.retentionTier ? { retention_tier: filter.retentionTier } : {}),
  }
}
