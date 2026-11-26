// The admin screens' rules: pure functions that return `{ ok: true, value }` or `{ ok: false,
// failure }`. They enforce only what the UI knows, so a form can say what is wrong before anything
// is sent. Every one is re-checked by the service, and the UI never grants more than IAM does
// (LLD §6.3). "Today" and "now" are inputs, never read from the clock. Failures are codes; the
// screens turn them into catalogue messages. The first failing check wins, in the order written.
import type { DepartmentAssignment, Member, RemovalResolution } from '../entities/member'
import type { InvitationRequest } from '../entities/invitation'
import type { SeatUsage } from '../entities/seats'
import type { DelegationPolicy, ResidencyMode, TenantSettings, TenantSettingsPatch } from '../entities/settings'
import type { DepartmentMapping, GroupMappings, LevelMapping, TenantRoleMapping } from '../entities/groupMapping'
import type { RoleLabel } from '../entities/department'
import type { UserSummary } from '../entities/user'
import type { UserProfileEdit } from '../repositories/UserProfilePort'
import type { AuditFilter } from '../value-objects/AuditFilter'
import type { Cursor } from '../value-objects/Cursor'
import type { RecordVersion } from '../value-objects/RecordVersion'
import { ADMIN, DEPARTMENT_LEVELS, OWNER, TENANT_ROLES, type DepartmentLevel, type TenantRole } from '../vocabulary'

export type Planned<T, F extends string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly failure: F; /** Where in a list or form, when it helps (a field, `departments[2]`). */ readonly at?: string }

const ok = <T>(value: T): { ok: true; value: T } => ({ ok: true, value })
const refuse = <F extends string>(failure: F, at?: string): { ok: false; failure: F; at?: string } => (at === undefined ? { ok: false, failure } : { ok: false, failure, at })

/** The roles only an owner may grant or remove (HLD §6.4; IAM-FE-Q14: the UI follows the HLD). */
const OWNER_ONLY_ROLES: readonly TenantRole[] = [OWNER, ADMIN]

const byVocabulary = <T extends string>(order: readonly T[], values: readonly T[]) => order.filter((v) => values.includes(v))

// ── Seats ──────────────────────────────────────────────────────────────────────────────────────

/** Seats counted against the cap: active members plus pending invitations (SEAT-1). */
export const seatsUsed = (s: SeatUsage): number => s.activeUsers + s.pendingInvitations

/** `room` (invites allowed), `full` (used ≥ licensed: invites blocked), `over` (active > licensed). */
export function seatState(s: SeatUsage): 'room' | 'full' | 'over' {
  if (s.activeUsers > s.licensedSeats) return 'over'
  return seatsUsed(s) >= s.licensedSeats ? 'full' : 'room'
}

// ── Department levels ──────────────────────────────────────────────────────────────────────────

/** preparator < reviewer < approver. */
export const levelRank = (level: DepartmentLevel): number => DEPARTMENT_LEVELS.indexOf(level)

/** Whether `member` holds `tenant_owner` and is the only active owner left (IAM-UX-7). */
export const isLastOwner = (member: Member, activeOwnerCount: number): boolean =>
  member.tenantRoles.includes(OWNER) && member.status === 'active' && activeOwnerCount <= 1

// ── Invitation (E1a, P-6) ──────────────────────────────────────────────────────────────────────

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type InvitationFailure = 'email-invalid' | 'name-required' | 'name-too-long' | 'seats-full' | 'role-not-offered' | 'department-inactive'

export interface InvitationInput {
  readonly email: string
  readonly fullName: string
  readonly tenantRoles: readonly TenantRole[]
  readonly departments: readonly DepartmentAssignment[]
  readonly seats: SeatUsage
  readonly actorIsOwner: boolean
  /** The tenant's active departments: only these may be mapped. */
  readonly activeDepartmentIds: ReadonlySet<string>
}

/** Order: email, name, seats, roles, departments. Checked again by the service (`409 SEAT_LIMIT_REACHED`, …). */
export function planInvitation(i: InvitationInput): Planned<InvitationRequest, InvitationFailure> {
  const email = i.email.trim()
  if (email.length === 0 || email.length > 254 || !EMAIL.test(email)) return refuse('email-invalid', 'email')
  const fullName = i.fullName.trim()
  if (fullName.length === 0) return refuse('name-required', 'fullName')
  if (fullName.length > 200) return refuse('name-too-long', 'fullName')
  if (seatsUsed(i.seats) >= i.seats.licensedSeats) return refuse('seats-full')
  if (!i.actorIsOwner && i.tenantRoles.some((r) => OWNER_ONLY_ROLES.includes(r))) return refuse('role-not-offered', 'roles')
  const departments = new Map<string, DepartmentLevel>()
  for (const [index, d] of i.departments.entries()) {
    if (!i.activeDepartmentIds.has(d.departmentId)) return refuse('department-inactive', `departments[${index}]`)
    departments.set(d.departmentId, d.level)
  }
  return ok({
    email,
    fullName,
    initialTenantRoles: byVocabulary(TENANT_ROLES, i.tenantRoles),
    initialDeptMappings: [...departments].map(([departmentId, level]) => ({ departmentId, level })),
  })
}

// ── Roles (E2, P-28) ───────────────────────────────────────────────────────────────────────────

export type RoleChangeFailure = 'member-role' | 'invalid-role' | 'role-not-offered' | 'last-owner'

export interface RoleChangeInput {
  readonly current: readonly TenantRole[]
  /** The wanted list as the form holds it: strings, so `member` and unknown codes can be refused. */
  readonly next: readonly string[]
  readonly actorIsOwner: boolean
  /** Active members holding `tenant_owner`, the one being changed included. */
  readonly ownerCount: number
}

/** P-28 is full replacement: the value is the whole list, in the vocabulary's order, with no duplicate. */
export function planRoleChange(i: RoleChangeInput): Planned<{ readonly roles: readonly TenantRole[] }, RoleChangeFailure> {
  if (i.next.includes('member')) return refuse('member-role')
  const unknown = i.next.find((r) => !(TENANT_ROLES as readonly string[]).includes(r))
  if (unknown !== undefined) return refuse('invalid-role', unknown)
  const next = byVocabulary(TENANT_ROLES, i.next as readonly TenantRole[])
  if (!i.actorIsOwner) {
    const changed = OWNER_ONLY_ROLES.filter((r) => i.current.includes(r) !== next.includes(r))
    if (changed.length > 0) return refuse('role-not-offered', changed[0])
  }
  if (i.current.includes(OWNER) && !next.includes(OWNER) && i.ownerCount <= 1) return refuse('last-owner')
  return ok({ roles: next })
}

// ── Membership status (E2, P-7) ────────────────────────────────────────────────────────────────

export type StatusFailure = 'last-owner' | 'not-active' | 'not-suspended'

export interface StatusInput {
  readonly member: Member
  readonly activeOwnerCount: number
}

export interface StatusChange {
  readonly status: 'active' | 'suspended'
  readonly recordVersion: RecordVersion
}

/** Suspending never moves work. Suspending the last owner is refused (`422 LAST_OWNER_REMOVAL`). */
export function planSuspension(i: StatusInput): Planned<StatusChange, StatusFailure> {
  if (i.member.status !== 'active') return refuse('not-active')
  if (isLastOwner(i.member, i.activeOwnerCount)) return refuse('last-owner')
  return ok({ status: 'suspended', recordVersion: i.member.recordVersion })
}

export function planReactivation(i: StatusInput): Planned<StatusChange, StatusFailure> {
  if (i.member.status !== 'suspended') return refuse('not-suspended')
  return ok({ status: 'active', recordVersion: i.member.recordVersion })
}

// ── Departments of a member (E2, P-10 and P-11) ────────────────────────────────────────────────

export type DepartmentAssignmentFailure = 'department-inactive'
export type DepartmentRemovalFailure = 'not-assigned'

export interface DepartmentAssignmentInput {
  readonly departmentId: string
  readonly level: DepartmentLevel
  readonly current: readonly DepartmentAssignment[]
  readonly activeDepartmentIds: ReadonlySet<string>
}

export interface DepartmentChange {
  readonly departmentId: string
  readonly level: DepartmentLevel
  /** A demotion runs the impact review (E2a) first; a promotion or a new department never does. */
  readonly needsImpactReview: boolean
}

/** Adds a department or changes a level (the same `PUT`). Only the tenant's active departments. */
export function planDepartmentAssignment(i: DepartmentAssignmentInput): Planned<DepartmentChange, DepartmentAssignmentFailure> {
  if (!i.activeDepartmentIds.has(i.departmentId)) return refuse('department-inactive', 'departmentId')
  const existing = i.current.find((d) => d.departmentId === i.departmentId)
  const demotion = existing !== undefined && levelRank(i.level) < levelRank(existing.level)
  return ok({ departmentId: i.departmentId, level: i.level, needsImpactReview: demotion })
}

/** Removing a department always runs the impact review. Retiring a department does not block it: only membership matters. */
export function planDepartmentRemoval(i: { readonly departmentId: string; readonly current: readonly DepartmentAssignment[] }): Planned<{ readonly departmentId: string; readonly needsImpactReview: true }, DepartmentRemovalFailure> {
  if (!i.current.some((d) => d.departmentId === i.departmentId)) return refuse('not-assigned', 'departmentId')
  return ok({ departmentId: i.departmentId, needsImpactReview: true })
}

// ── Removal (E2, P-8) and its resolution (E2a, P-26) ───────────────────────────────────────────

export type RemovalFailure = 'last-owner'

/** Removal always runs the impact review. The last owner stays (IAM-UX-7). */
export function planRemoval(i: StatusInput): Planned<{ readonly userId: string; readonly needsImpactReview: true }, RemovalFailure> {
  if (isLastOwner(i.member, i.activeOwnerCount)) return refuse('last-owner')
  return ok({ userId: i.member.userId, needsImpactReview: true })
}

export type ResolutionFailure = 'replacement-required' | 'replacement-is-subject'

export interface ResolutionInput {
  readonly action: 'replace_delegate' | 'stop_workflows'
  readonly replacementUserId?: string
  /** The member being removed or demoted: they cannot cover for themselves. */
  readonly subjectUserId?: string
}

/** The P-26 body. `stop_workflows` carries no replacement even if the form still holds one. */
export function planResolution(i: ResolutionInput): Planned<RemovalResolution, ResolutionFailure> {
  if (i.action === 'stop_workflows') return ok({ action: 'stop_workflows' })
  const replacement = i.replacementUserId?.trim()
  if (!replacement) return refuse('replacement-required', 'replacementUserId')
  if (replacement === i.subjectUserId) return refuse('replacement-is-subject', 'replacementUserId')
  return ok({ action: 'replace_delegate', replacementUserId: replacement })
}

// ── Role labels (E3, P-13) ─────────────────────────────────────────────────────────────────────

export type RoleLabelFailure = 'name-required' | 'name-too-long' | 'no-change'

/**
 * The longest label the screen accepts. The Swagger declares no limit for `display_name`, so this is
 * the UI's own cap (the label appears in selects and badges); the service may still refuse more.
 */
export const ROLE_LABEL_MAX = 100

/** A rename: the level's code never changes, only its label. Sends the version being replaced. */
export function planRoleLabel(draft: string, current: RoleLabel): Planned<{ readonly roleCode: RoleLabel['roleCode']; readonly displayName: string; readonly recordVersion: RoleLabel['recordVersion'] }, RoleLabelFailure> {
  const displayName = draft.trim()
  if (displayName === '') return refuse('name-required')
  if (displayName.length > ROLE_LABEL_MAX) return refuse('name-too-long')
  if (displayName === current.displayName) return refuse('no-change')
  return ok({ roleCode: current.roleCode, displayName, recordVersion: current.recordVersion })
}

// ── Profile edit (E2, PATCH /users/:id) ────────────────────────────────────────────────────────

export type ProfileEditFailure = 'name-required' | 'name-too-long' | 'title-too-long' | 'no-change'

export const PROFILE_TEXT_MAX = 200

/**
 * An admin's edit of another user's name and job title (the limits are User Profile's: 200 each).
 * The value is the changed fields plus the version being replaced (`expected_version` on the wire).
 * A blank job title clears it; a blank name is refused.
 */
export function planProfileEdit(draft: { readonly displayName: string; readonly jobTitle: string }, current: UserSummary): Planned<UserProfileEdit, ProfileEditFailure> {
  const displayName = draft.displayName.trim()
  const jobTitle = draft.jobTitle.trim()
  if (displayName === '') return refuse('name-required', 'displayName')
  if (displayName.length > PROFILE_TEXT_MAX) return refuse('name-too-long', 'displayName')
  if (jobTitle.length > PROFILE_TEXT_MAX) return refuse('title-too-long', 'jobTitle')
  const nameChanged = displayName !== current.displayName
  const titleChanged = jobTitle !== (current.jobTitle ?? '')
  if (!nameChanged && !titleChanged) return refuse('no-change')
  return ok({ ...(nameChanged ? { displayName } : {}), ...(titleChanged ? { jobTitle } : {}), expectedVersion: current.recordVersion })
}

// ── Group mappings (E5, GM-1…GM-6) ─────────────────────────────────────────────────────────────

export type GroupMappingFailure =
  | 'too-many-mappings'
  | 'group-required'
  | 'group-too-long'
  | 'duplicate-group'
  | 'role-not-allowed'
  | 'invalid-level'
  | 'owner-mapping-owner-only'

/** The service takes at most 500 rows per list. */
export const MAX_MAPPINGS = 500
/** A group name is limited to 255 bytes (UTF-8), not characters. */
export const MAX_GROUP_NAME_BYTES = 255

const utf8Bytes = (s: string): number => new TextEncoder().encode(s).length

function checkGroups(names: readonly string[], list: string): Planned<readonly string[], GroupMappingFailure> {
  if (names.length > MAX_MAPPINGS) return refuse('too-many-mappings', list)
  const seen = new Set<string>()
  const trimmed: string[] = []
  for (const [index, raw] of names.entries()) {
    const name = raw.trim()
    const at = `${list}[${index}]`
    if (name === '') return refuse('group-required', at)
    if (utf8Bytes(name) > MAX_GROUP_NAME_BYTES) return refuse('group-too-long', at)
    if (seen.has(name)) return refuse('duplicate-group', at)
    seen.add(name)
    trimmed.push(name)
  }
  return ok(trimmed)
}

export interface GroupMappingDraft {
  readonly departments: readonly DepartmentMapping[]
  /** `level` is a string here: the form holds what the user picked, and `member` or junk is refused. */
  readonly levels: readonly { readonly groupName: string; readonly level: string }[]
  readonly tenantRoles: readonly { readonly groupName: string; readonly role: string }[]
}

/**
 * The lists to write, each a full replacement (an omitted row is deleted). One group may appear once
 * per list; the same group in the department and level lists is how a group grants a department at
 * a level. Owner rows are an owner's to edit (see `current`). Mappings are additive only and apply at the user's
 * next SSO sign-in.
 */
export function planGroupMappings(d: GroupMappingDraft, actorIsOwner: boolean, current?: GroupMappings): Planned<GroupMappings, GroupMappingFailure> {
  const dept = checkGroups(d.departments.map((m) => m.groupName), 'departments')
  if (!dept.ok) return dept
  const lvl = checkGroups(d.levels.map((m) => m.groupName), 'levels')
  if (!lvl.ok) return lvl
  const roleNames = checkGroups(d.tenantRoles.map((m) => m.groupName), 'tenantRoles')
  if (!roleNames.ok) return roleNames

  const levels: LevelMapping[] = []
  for (const [index, m] of d.levels.entries()) {
    if (!(DEPARTMENT_LEVELS as readonly string[]).includes(m.level)) return refuse('invalid-level', `levels[${index}]`)
    levels.push({ groupName: lvl.value[index]!, level: m.level as DepartmentLevel })
  }
  const tenantRoles: TenantRoleMapping[] = []
  for (const [index, m] of d.tenantRoles.entries()) {
    const at = `tenantRoles[${index}]`
    if (m.role === 'member' || !(TENANT_ROLES as readonly string[]).includes(m.role)) return refuse('role-not-allowed', at)
    tenantRoles.push({ groupName: roleNames.value[index]!, role: m.role as TenantRole })
  }
  // Owner rows are an owner's to add, change or remove. A non-owner may save the rest of the list with
  // the owner rows left exactly as they are (given `current`, the lists as the service has them).
  if (!actorIsOwner) {
    const owners = (rows: readonly TenantRoleMapping[]) => rows.filter((r) => r.role === OWNER).map((r) => r.groupName).sort()
    const wanted = owners(tenantRoles)
    const had = owners(current?.tenantRoles ?? [])
    if (wanted.length !== had.length || wanted.some((g, i) => g !== had[i])) {
      const first = tenantRoles.findIndex((r) => r.role === OWNER && !had.includes(r.groupName))
      return refuse('owner-mapping-owner-only', first >= 0 ? `tenantRoles[${first}]` : 'tenantRoles')
    }
  }
  return ok({
    departments: d.departments.map((m, index) => ({ groupName: dept.value[index]!, departmentId: m.departmentId })),
    levels,
    tenantRoles,
  })
}

// ── Tenant settings (E6 workspace block, P-2) ──────────────────────────────────────────────────

export type TenantSettingsFailure = 'not-owner' | 'name-required' | 'locale-invalid' | 'mfa-window-out-of-range' | 'residency-invalid' | 'no-change'

export interface TenantSettingsDraft {
  readonly name: string
  readonly defaultLocale: string
  readonly mfaFreshnessSeconds: number
  readonly localAccountsEnabled: boolean
  readonly residencyMode: string
}

export const MFA_WINDOW_SECONDS = { min: 60, max: 900 } as const

/** A BCP-47 tag in its common shapes: `en`, `en-GB`, `zh-Hant-TW`. The service validates it fully. */
const LOCALE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/

/** Owner only. The value is the changed fields plus the version being replaced; nothing changed is refused. */
export function planTenantSettings(draft: TenantSettingsDraft, current: TenantSettings, actorIsOwner: boolean): Planned<TenantSettingsPatch, TenantSettingsFailure> {
  if (!actorIsOwner) return refuse('not-owner')
  const name = draft.name.trim()
  if (name === '') return refuse('name-required', 'name')
  if (!LOCALE.test(draft.defaultLocale)) return refuse('locale-invalid', 'defaultLocale')
  const s = draft.mfaFreshnessSeconds
  if (!Number.isInteger(s) || s < MFA_WINDOW_SECONDS.min || s > MFA_WINDOW_SECONDS.max) return refuse('mfa-window-out-of-range', 'mfaFreshnessSeconds')
  if (draft.residencyMode !== 'standard' && draft.residencyMode !== 'strict') return refuse('residency-invalid', 'residencyMode')
  const residencyMode: ResidencyMode = draft.residencyMode

  const patch: { -readonly [K in keyof TenantSettingsPatch]: TenantSettingsPatch[K] } = { recordVersion: current.recordVersion }
  let changed = false
  const set = <K extends keyof TenantSettingsPatch>(key: K, value: TenantSettingsPatch[K], differs: boolean) => {
    if (differs) {
      patch[key] = value
      changed = true
    }
  }
  set('name', name, name !== current.name)
  set('defaultLocale', draft.defaultLocale, draft.defaultLocale !== current.defaultLocale)
  set('mfaFreshnessSeconds', s, s !== current.mfaFreshnessSeconds)
  set('localAccountsEnabled', draft.localAccountsEnabled, draft.localAccountsEnabled !== current.localAccountsEnabled)
  set('residencyMode', residencyMode, residencyMode !== current.residencyMode)
  return changed ? ok(patch) : refuse('no-change')
}

// ── Delegation policy (E6 delegation block, DLG-7) ─────────────────────────────────────────────

export type DelegationPolicyFailure = 'days-out-of-range'

export const POLICY_DAYS = { min: 1, max: 180 } as const

const inDays = (n: number) => Number.isInteger(n) && n >= POLICY_DAYS.min && n <= POLICY_DAYS.max

/** Both lengths are whole days, 1 to 180. `at` names the field that is out of range. */
export function planDelegationPolicy(p: DelegationPolicy): Planned<DelegationPolicy, DelegationPolicyFailure> {
  if (!inDays(p.maxDurationDays)) return refuse('days-out-of-range', 'maxDurationDays')
  if (!inDays(p.reviewWindowDays)) return refuse('days-out-of-range', 'reviewWindowDays')
  return ok({ maxDurationDays: p.maxDurationDays, reviewWindowDays: p.reviewWindowDays })
}

// ── Audit search (E7, AL-1) ────────────────────────────────────────────────────────────────────

export type AuditQueryFailure = 'range-inverted' | 'range-invalid' | 'page-too-large' | 'page-too-small' | 'one-entry-type-only'

export const AUDIT_PAGE = { default: 100, max: 1000 } as const

/**
 * The service takes `entry_type` repeated (`collectionFormat: multi`), but the SDK's ApiClient sends a
 * query value with `String(v)`, so two values become one comma-joined string the service will not
 * match. One entry type per search until the SDK can repeat a query key (a request to
 * platform-reactcommon, LLD §15 #18). Exports take a JSON body and are not limited.
 */
export const MAX_SEARCH_ENTRY_TYPES = 1

export interface AuditQuery {
  readonly filter: AuditFilter
  readonly limit: number
  readonly cursor?: Cursor
}

/**
 * The query to send. The service clamps `from` to the plan's window (Starter 1 year, Pro 3,
 * Enterprise 7) and says so in the response (`windowClamped`, `effectiveFrom`); the UI shows that,
 * it does not guess the window.
 */
export function planAuditQuery(filter: AuditFilter, page: { readonly limit?: number; readonly cursor?: Cursor } = {}): Planned<AuditQuery, AuditQueryFailure> {
  const from = filter.from === undefined ? undefined : Date.parse(filter.from)
  const to = filter.to === undefined ? undefined : Date.parse(filter.to)
  if ((from !== undefined && Number.isNaN(from)) || (to !== undefined && Number.isNaN(to))) return refuse('range-invalid')
  if (from !== undefined && to !== undefined && from > to) return refuse('range-inverted')
  if (filter.entryTypes.length > MAX_SEARCH_ENTRY_TYPES) return refuse('one-entry-type-only', 'entryTypes')
  const limit = page.limit ?? AUDIT_PAGE.default
  if (!Number.isInteger(limit) || limit < 1) return refuse('page-too-small')
  if (limit > AUDIT_PAGE.max) return refuse('page-too-large')
  return ok({ filter, limit, ...(page.cursor ? { cursor: page.cursor } : {}) })
}
