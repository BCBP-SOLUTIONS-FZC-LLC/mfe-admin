// Each rule, both ways: the case it accepts and every case it refuses (LLD §6.3). The rules enforce
// only what the UI knows; the service re-checks all of them.
import { describe, expect, it } from '@rstest/core'
import {
  AUDIT_PAGE,
  MAX_GROUP_NAME_BYTES,
  MAX_MAPPINGS,
  isLastOwner,
  levelRank,
  planAuditQuery,
  planDelegationPolicy,
  planDepartmentAssignment,
  planDepartmentRemoval,
  planGroupMappings,
  planInvitation,
  planProfileEdit,
  planRoleLabel,
  ROLE_LABEL_MAX,
  planReactivation,
  planRemoval,
  planResolution,
  planRoleChange,
  planSuspension,
  planTenantSettings,
  seatState,
  seatsUsed,
  type InvitationInput,
} from '../../../src/domain/rules/admin-rules'
import { parseCursor } from '../../../src/domain/value-objects/Cursor'
import { recordVersion } from '../../../src/domain/value-objects/RecordVersion'
import { member, seats, settings } from '../../fixtures/domain'
import { ADA } from '../../fixtures/people'

const failure = (r: { ok: boolean; failure?: string }) => (r.ok ? 'ok' : r.failure)
const at = (r: { ok: boolean; at?: string }) => (r.ok ? undefined : r.at)

describe('seats', () => {
  it('counts active members plus pending invitations against the cap', () => {
    expect(seatsUsed(seats({ activeUsers: 3, pendingInvitations: 2 }))).toBe(5)
  })

  it.each([
    [{ activeUsers: 3, pendingInvitations: 1, licensedSeats: 10 }, 'room'],
    [{ activeUsers: 3, pendingInvitations: 6, licensedSeats: 10 }, 'room'],
    [{ activeUsers: 5, pendingInvitations: 5, licensedSeats: 10 }, 'full'],
    [{ activeUsers: 10, pendingInvitations: 0, licensedSeats: 10 }, 'full'],
    [{ activeUsers: 8, pendingInvitations: 4, licensedSeats: 10 }, 'full'],
    [{ activeUsers: 11, pendingInvitations: 0, licensedSeats: 10 }, 'over'],
  ] as const)('%j → %s', (usage, state) => {
    expect(seatState(usage)).toBe(state)
  })
})

describe('levels and the last owner', () => {
  it('ranks preparator < reviewer < approver', () => {
    expect(levelRank('preparator')).toBeLessThan(levelRank('reviewer'))
    expect(levelRank('reviewer')).toBeLessThan(levelRank('approver'))
  })

  it('knows the last owner: an active owner when no other active owner is left', () => {
    const owner = member({ tenantRoles: ['tenant_owner'] })
    expect(isLastOwner(owner, 1)).toBe(true)
    expect(isLastOwner(owner, 2)).toBe(false)
    expect(isLastOwner(member({ tenantRoles: ['tenant_admin'] }), 1)).toBe(false)
    expect(isLastOwner(member({ tenantRoles: ['tenant_owner'], status: 'suspended' }), 1)).toBe(false)
  })
})

describe('planInvitation (P-6)', () => {
  const input = (o: Partial<InvitationInput> = {}): InvitationInput => ({
    email: ' ada@example.com ',
    fullName: ' Ada Lovelace ',
    tenantRoles: [],
    departments: [],
    seats: seats(),
    actorIsOwner: false,
    activeDepartmentIds: new Set(['d-1', 'd-2']),
    ...o,
  })

  it('accepts and returns the trimmed P-6 body, roles in vocabulary order, departments de-duplicated', () => {
    const r = planInvitation(
      input({
        tenantRoles: ['tender_admin'],
        departments: [
          { departmentId: 'd-1', level: 'preparator' },
          { departmentId: 'd-2', level: 'approver' },
          { departmentId: 'd-1', level: 'reviewer' },
        ],
      }),
    )
    expect(r).toEqual({
      ok: true,
      value: {
        email: 'ada@example.com',
        fullName: 'Ada Lovelace',
        initialTenantRoles: ['tender_admin'],
        initialDeptMappings: [
          { departmentId: 'd-1', level: 'reviewer' },
          { departmentId: 'd-2', level: 'approver' },
        ],
      },
    })
  })

  it.each([
    ['empty', ''],
    ['no at sign', 'ada.example.com'],
    ['no domain dot', 'ada@example'],
    ['inner space', 'ada lovelace@example.com'],
    ['over 254 characters', `${'a'.repeat(250)}@example.com`],
  ])('refuses an invalid email (%s)', (_name, email) => {
    expect(failure(planInvitation(input({ email })))).toBe('email-invalid')
  })

  it('accepts an email of exactly 254 characters', () => {
    const email = `${'a'.repeat(254 - '@example.com'.length)}@example.com`
    expect(email).toHaveLength(254)
    expect(planInvitation(input({ email })).ok).toBe(true)
  })

  it('refuses a missing name, and a name over 200 characters (200 is allowed)', () => {
    expect(failure(planInvitation(input({ fullName: '   ' })))).toBe('name-required')
    expect(failure(planInvitation(input({ fullName: 'a'.repeat(201) })))).toBe('name-too-long')
    expect(planInvitation(input({ fullName: 'a'.repeat(200) })).ok).toBe(true)
  })

  it('refuses when the seats are full (used ≥ licensed), not one short of it', () => {
    expect(failure(planInvitation(input({ seats: seats({ activeUsers: 5, pendingInvitations: 5, licensedSeats: 10 }) })))).toBe('seats-full')
    expect(planInvitation(input({ seats: seats({ activeUsers: 5, pendingInvitations: 4, licensedSeats: 10 }) })).ok).toBe(true)
  })

  it('offers tenant_owner and tenant_admin to owners only; tender_admin to any admin', () => {
    expect(failure(planInvitation(input({ tenantRoles: ['tenant_owner'] })))).toBe('role-not-offered')
    expect(failure(planInvitation(input({ tenantRoles: ['tenant_admin'] })))).toBe('role-not-offered')
    expect(planInvitation(input({ tenantRoles: ['tender_admin'] })).ok).toBe(true)
    expect(planInvitation(input({ tenantRoles: ['tenant_owner', 'tenant_admin'], actorIsOwner: true })).ok).toBe(true)
  })

  it('refuses a department the tenant has not activated, and says which row', () => {
    const r = planInvitation(input({ departments: [{ departmentId: 'd-1', level: 'reviewer' }, { departmentId: 'd-9', level: 'reviewer' }] }))
    expect(failure(r)).toBe('department-inactive')
    expect(at(r)).toBe('departments[1]')
  })

  it('checks in a fixed order: email, name, seats, roles, departments', () => {
    const all = input({
      email: 'bad',
      fullName: '',
      seats: seats({ activeUsers: 10, licensedSeats: 10 }),
      tenantRoles: ['tenant_owner'],
      departments: [{ departmentId: 'd-9', level: 'reviewer' }],
    })
    expect(failure(planInvitation(all))).toBe('email-invalid')
    expect(failure(planInvitation({ ...all, email: 'a@b.co' }))).toBe('name-required')
    expect(failure(planInvitation({ ...all, email: 'a@b.co', fullName: 'A' }))).toBe('seats-full')
    expect(failure(planInvitation({ ...all, email: 'a@b.co', fullName: 'A', seats: seats() }))).toBe('role-not-offered')
    expect(failure(planInvitation({ ...all, email: 'a@b.co', fullName: 'A', seats: seats(), tenantRoles: [] }))).toBe('department-inactive')
  })
})

describe('planRoleChange (P-28, full replacement)', () => {
  const base = { current: ['tender_admin'] as const, actorIsOwner: false, ownerCount: 2 }

  it('accepts and returns the whole list, in vocabulary order, without duplicates', () => {
    const r = planRoleChange({ ...base, current: [], next: ['tender_admin', 'tender_admin'] })
    expect(r).toEqual({ ok: true, value: { roles: ['tender_admin'] } })
    const owner = planRoleChange({ ...base, actorIsOwner: true, current: [], next: ['tender_admin', 'tenant_owner'] })
    expect(owner).toEqual({ ok: true, value: { roles: ['tenant_owner', 'tender_admin'] } })
  })

  it('accepts removing every role (an empty list leaves the implicit member role)', () => {
    expect(planRoleChange({ ...base, next: [] })).toEqual({ ok: true, value: { roles: [] } })
  })

  it('refuses the implicit `member` role, and any code outside the vocabulary', () => {
    expect(failure(planRoleChange({ ...base, next: ['member'] }))).toBe('member-role')
    const r = planRoleChange({ ...base, next: ['tender_admin', 'superuser'] })
    expect(failure(r)).toBe('invalid-role')
    expect(at(r)).toBe('superuser')
  })

  it('lets only an owner grant or remove tenant_owner / tenant_admin (IAM-FE-Q14: the UI follows the HLD)', () => {
    expect(failure(planRoleChange({ ...base, next: ['tender_admin', 'tenant_admin'] }))).toBe('role-not-offered')
    expect(failure(planRoleChange({ ...base, current: ['tenant_admin'], next: [] }))).toBe('role-not-offered')
    expect(planRoleChange({ ...base, actorIsOwner: true, next: ['tender_admin', 'tenant_admin'] }).ok).toBe(true)
  })

  it('lets a non-owner keep an admin role they are not changing', () => {
    expect(planRoleChange({ ...base, current: ['tenant_admin'], next: ['tenant_admin', 'tender_admin'] }).ok).toBe(true)
  })

  it('refuses taking tenant_owner from the last owner, but not from one of several', () => {
    const last = { current: ['tenant_owner'] as const, next: ['tender_admin'], actorIsOwner: true }
    expect(failure(planRoleChange({ ...last, ownerCount: 1 }))).toBe('last-owner')
    expect(planRoleChange({ ...last, ownerCount: 2 }).ok).toBe(true)
  })
})

describe('planSuspension and planReactivation (P-7)', () => {
  it('suspends an active member with the version being replaced', () => {
    expect(planSuspension({ member: member(), activeOwnerCount: 2 })).toEqual({ ok: true, value: { status: 'suspended', recordVersion: recordVersion(3) } })
  })

  it('refuses suspending the last owner, but not one of several, and not a non-owner', () => {
    const owner = member({ tenantRoles: ['tenant_owner'] })
    expect(failure(planSuspension({ member: owner, activeOwnerCount: 1 }))).toBe('last-owner')
    expect(planSuspension({ member: owner, activeOwnerCount: 2 }).ok).toBe(true)
    expect(planSuspension({ member: member({ tenantRoles: ['tenant_admin'] }), activeOwnerCount: 1 }).ok).toBe(true)
  })

  it('refuses suspending someone already suspended', () => {
    expect(failure(planSuspension({ member: member({ status: 'suspended' }), activeOwnerCount: 2 }))).toBe('not-active')
  })

  it('reactivates a suspended member, and refuses an active one', () => {
    expect(planReactivation({ member: member({ status: 'suspended' }), activeOwnerCount: 1 })).toEqual({ ok: true, value: { status: 'active', recordVersion: recordVersion(3) } })
    expect(failure(planReactivation({ member: member(), activeOwnerCount: 1 }))).toBe('not-suspended')
  })
})

describe('planDepartmentAssignment and planDepartmentRemoval (P-10, P-11)', () => {
  const active = new Set(['d-1', 'd-2'])
  const current = [{ departmentId: 'd-1', level: 'approver' as const }]

  it('adds a new department without an impact review', () => {
    expect(planDepartmentAssignment({ departmentId: 'd-2', level: 'preparator', current, activeDepartmentIds: active })).toEqual({
      ok: true,
      value: { departmentId: 'd-2', level: 'preparator', needsImpactReview: false },
    })
  })

  it('flags a demotion for the impact review, and a promotion or same level not', () => {
    const run = (level: 'preparator' | 'reviewer' | 'approver') =>
      planDepartmentAssignment({ departmentId: 'd-1', level, current, activeDepartmentIds: active })
    expect(run('reviewer')).toMatchObject({ ok: true, value: { needsImpactReview: true } })
    expect(run('preparator')).toMatchObject({ ok: true, value: { needsImpactReview: true } })
    expect(run('approver')).toMatchObject({ ok: true, value: { needsImpactReview: false } })
    const promoted = planDepartmentAssignment({ departmentId: 'd-1', level: 'approver', current: [{ departmentId: 'd-1', level: 'preparator' }], activeDepartmentIds: active })
    expect(promoted).toMatchObject({ ok: true, value: { needsImpactReview: false } })
  })

  it('refuses a department the tenant has not activated (422 DEPARTMENT_NOT_ACTIVE_FOR_TENANT)', () => {
    const r = planDepartmentAssignment({ departmentId: 'd-9', level: 'reviewer', current, activeDepartmentIds: active })
    expect(failure(r)).toBe('department-inactive')
    expect(at(r)).toBe('departmentId')
  })

  it('removes a department the member is in, always with the impact review', () => {
    expect(planDepartmentRemoval({ departmentId: 'd-1', current })).toEqual({ ok: true, value: { departmentId: 'd-1', needsImpactReview: true } })
  })

  it('refuses removing a department the member is not in', () => {
    expect(failure(planDepartmentRemoval({ departmentId: 'd-2', current }))).toBe('not-assigned')
  })
})

describe('planRemoval (P-8)', () => {
  it('accepts, always with the impact review', () => {
    expect(planRemoval({ member: member({ userId: 'u-5' }), activeOwnerCount: 1 })).toEqual({ ok: true, value: { userId: 'u-5', needsImpactReview: true } })
  })

  it('refuses removing the last owner (IAM-UX-7), but not one of several', () => {
    const owner = member({ tenantRoles: ['tenant_owner'] })
    expect(failure(planRemoval({ member: owner, activeOwnerCount: 1 }))).toBe('last-owner')
    expect(planRemoval({ member: owner, activeOwnerCount: 2 }).ok).toBe(true)
  })
})

describe('planResolution (P-26)', () => {
  it('replaces the delegate with a trimmed ID', () => {
    expect(planResolution({ action: 'replace_delegate', replacementUserId: ' u-7 ' })).toEqual({ ok: true, value: { action: 'replace_delegate', replacementUserId: 'u-7' } })
  })

  it('needs a replacement to replace the delegate', () => {
    expect(failure(planResolution({ action: 'replace_delegate' }))).toBe('replacement-required')
    expect(failure(planResolution({ action: 'replace_delegate', replacementUserId: '  ' }))).toBe('replacement-required')
  })

  it('refuses the member being removed as their own replacement', () => {
    expect(failure(planResolution({ action: 'replace_delegate', replacementUserId: 'u-1', subjectUserId: 'u-1' }))).toBe('replacement-is-subject')
  })

  it('stops the workflows with no replacement, even if the form still holds one', () => {
    expect(planResolution({ action: 'stop_workflows', replacementUserId: 'u-7' })).toEqual({ ok: true, value: { action: 'stop_workflows' } })
  })
})

describe('planRoleLabel (P-13)', () => {
  const current = { roleCode: 'approver' as const, displayName: 'Director', recordVersion: recordVersion(3) }

  it('sends the trimmed label with the version being replaced, and the code unchanged', () => {
    expect(planRoleLabel('  Head of Department ', current)).toEqual({ ok: true, value: { roleCode: 'approver', displayName: 'Head of Department', recordVersion: recordVersion(3) } })
  })

  it('refuses a blank label, one over the cap (the cap itself is allowed), and no change', () => {
    expect(failure(planRoleLabel('   ', current))).toBe('name-required')
    expect(failure(planRoleLabel('a'.repeat(ROLE_LABEL_MAX + 1), current))).toBe('name-too-long')
    expect(planRoleLabel('a'.repeat(ROLE_LABEL_MAX), current).ok).toBe(true)
    expect(failure(planRoleLabel(' Director ', current))).toBe('no-change')
  })
})

describe('planProfileEdit (PATCH /users/:id)', () => {
  const current = { ...ADA, recordVersion: recordVersion(2) }

  it('sends only the changed fields, trimmed, with the version being replaced', () => {
    expect(planProfileEdit({ displayName: ' Ada King ', jobTitle: 'Chief Engineer' }, current)).toEqual({ ok: true, value: { displayName: 'Ada King', expectedVersion: recordVersion(2) } })
    expect(planProfileEdit({ displayName: 'Ada Lovelace', jobTitle: 'CTO' }, current)).toEqual({ ok: true, value: { jobTitle: 'CTO', expectedVersion: recordVersion(2) } })
    expect(planProfileEdit({ displayName: 'Ada King', jobTitle: 'CTO' }, current)).toEqual({ ok: true, value: { displayName: 'Ada King', jobTitle: 'CTO', expectedVersion: recordVersion(2) } })
  })

  it('lets a blank job title clear it, and treats an absent title as blank', () => {
    expect(planProfileEdit({ displayName: 'Ada Lovelace', jobTitle: '' }, current)).toEqual({ ok: true, value: { jobTitle: '', expectedVersion: recordVersion(2) } })
    expect(failure(planProfileEdit({ displayName: 'Ada Lovelace', jobTitle: '' }, { ...current, jobTitle: undefined } as never))).toBe('no-change')
  })

  it('refuses a blank name, and a name or title over 200 characters (200 is allowed)', () => {
    expect(failure(planProfileEdit({ displayName: '  ', jobTitle: 'x' }, current))).toBe('name-required')
    expect(failure(planProfileEdit({ displayName: 'a'.repeat(201), jobTitle: '' }, current))).toBe('name-too-long')
    expect(failure(planProfileEdit({ displayName: 'Ada', jobTitle: 'a'.repeat(201) }, current))).toBe('title-too-long')
    expect(planProfileEdit({ displayName: 'a'.repeat(200), jobTitle: 'b'.repeat(200) }, current).ok).toBe(true)
  })

  it('refuses a save with nothing changed', () => {
    expect(failure(planProfileEdit({ displayName: 'Ada Lovelace', jobTitle: 'Chief Engineer' }, current))).toBe('no-change')
  })
})

describe('planGroupMappings (GM-1…GM-6)', () => {
  const draft = {
    departments: [{ groupName: ' eng ', departmentId: 'd-1' }],
    levels: [{ groupName: 'eng', level: 'reviewer' }],
    tenantRoles: [{ groupName: 'admins', role: 'tenant_admin' }],
  }

  it('accepts and returns the lists with trimmed group names', () => {
    expect(planGroupMappings(draft, false)).toEqual({
      ok: true,
      value: {
        departments: [{ groupName: 'eng', departmentId: 'd-1' }],
        levels: [{ groupName: 'eng', level: 'reviewer' }],
        tenantRoles: [{ groupName: 'admins', role: 'tenant_admin' }],
      },
    })
  })

  it('accepts empty lists: writing an empty list deletes every row', () => {
    expect(planGroupMappings({ departments: [], levels: [], tenantRoles: [] }, false)).toEqual({ ok: true, value: { departments: [], levels: [], tenantRoles: [] } })
  })

  it('requires a group name, and says which row', () => {
    const r = planGroupMappings({ ...draft, departments: [{ groupName: 'eng', departmentId: 'd-1' }, { groupName: '  ', departmentId: 'd-2' }] }, false)
    expect(failure(r)).toBe('group-required')
    expect(at(r)).toBe('departments[1]')
  })

  it('limits a group name to 255 bytes, not characters', () => {
    const exact = 'a'.repeat(MAX_GROUP_NAME_BYTES)
    expect(planGroupMappings({ ...draft, levels: [{ groupName: exact, level: 'reviewer' }] }, false).ok).toBe(true)
    expect(failure(planGroupMappings({ ...draft, levels: [{ groupName: exact + 'a', level: 'reviewer' }] }, false))).toBe('group-too-long')
    // 128 two-byte characters are 256 bytes.
    const wide = 'é'.repeat(128)
    expect(wide.length).toBe(128)
    expect(failure(planGroupMappings({ ...draft, levels: [{ groupName: wide, level: 'reviewer' }] }, false))).toBe('group-too-long')
  })

  it('refuses the same group twice in one list (after trimming), but allows it across lists', () => {
    const dup = planGroupMappings({ ...draft, tenantRoles: [{ groupName: 'a', role: 'tender_admin' }, { groupName: ' a ', role: 'tenant_admin' }] }, false)
    expect(failure(dup)).toBe('duplicate-group')
    expect(at(dup)).toBe('tenantRoles[1]')
    expect(planGroupMappings(draft, false).ok).toBe(true)
  })

  it('refuses more than 500 rows in a list', () => {
    const rows = Array.from({ length: MAX_MAPPINGS + 1 }, (_, i) => ({ groupName: `g${i}`, departmentId: 'd-1' }))
    expect(failure(planGroupMappings({ ...draft, departments: rows }, false))).toBe('too-many-mappings')
    expect(planGroupMappings({ ...draft, departments: rows.slice(0, MAX_MAPPINGS) }, false).ok).toBe(true)
  })

  it('refuses the implicit `member` role and any unknown role or level', () => {
    expect(failure(planGroupMappings({ ...draft, tenantRoles: [{ groupName: 'a', role: 'member' }] }, true))).toBe('role-not-allowed')
    expect(failure(planGroupMappings({ ...draft, tenantRoles: [{ groupName: 'a', role: 'root' }] }, true))).toBe('role-not-allowed')
    const level = planGroupMappings({ ...draft, levels: [{ groupName: 'eng', level: 'god' }] }, true)
    expect(failure(level)).toBe('invalid-level')
    expect(at(level)).toBe('levels[0]')
  })

  it('lets only an owner add a tenant_owner mapping row', () => {
    const owner = { ...draft, tenantRoles: [{ groupName: 'owners', role: 'tenant_owner' }] }
    const r = planGroupMappings(owner, false)
    expect(failure(r)).toBe('owner-mapping-owner-only')
    expect(at(r)).toBe('tenantRoles[0]')
    expect(planGroupMappings(owner, true).ok).toBe(true)
  })

  describe('with the lists as the service has them (an admin saving beside an owner row)', () => {
    const current = { departments: [], levels: [], tenantRoles: [{ groupName: 'owners', role: 'tenant_owner' as const }, { groupName: 'admins', role: 'tenant_admin' as const }] }
    const keep = (extra: { groupName: string; role: string }[] = []) => ({ ...draft, tenantRoles: [{ groupName: 'owners', role: 'tenant_owner' }, { groupName: 'admins', role: 'tenant_admin' }, ...extra] })

    it('lets a non-owner save when the owner rows are exactly as they were', () => {
      expect(planGroupMappings(keep([{ groupName: 'tenders', role: 'tender_admin' }]), false, current).ok).toBe(true)
    })

    it('refuses a non-owner removing an owner row', () => {
      const without = { ...draft, tenantRoles: [{ groupName: 'admins', role: 'tenant_admin' }] }
      expect(failure(planGroupMappings(without, false, current))).toBe('owner-mapping-owner-only')
      expect(at(planGroupMappings(without, false, current))).toBe('tenantRoles')
    })

    it('refuses a non-owner adding another owner row, and says which', () => {
      const r = planGroupMappings(keep([{ groupName: 'more-owners', role: 'tenant_owner' }]), false, current)
      expect(failure(r)).toBe('owner-mapping-owner-only')
      expect(at(r)).toBe('tenantRoles[2]')
    })

    it('refuses a non-owner moving an owner row to another group', () => {
      const moved = { ...draft, tenantRoles: [{ groupName: 'renamed', role: 'tenant_owner' }, { groupName: 'admins', role: 'tenant_admin' }] }
      expect(failure(planGroupMappings(moved, false, current))).toBe('owner-mapping-owner-only')
    })

    it('lets an owner change owner rows as they like', () => {
      expect(planGroupMappings(keep([{ groupName: 'more-owners', role: 'tenant_owner' }]), true, current).ok).toBe(true)
    })
  })
})

describe('planTenantSettings (P-2)', () => {
  const current = settings()
  const draft = { name: 'Acme', defaultLocale: 'en', mfaFreshnessSeconds: 300, localAccountsEnabled: true, residencyMode: 'standard' }

  it('sends only the changed fields, with the version being replaced', () => {
    const r = planTenantSettings({ ...draft, name: ' Acme Ltd ', mfaFreshnessSeconds: 600 }, current, true)
    expect(r).toEqual({ ok: true, value: { name: 'Acme Ltd', mfaFreshnessSeconds: 600, recordVersion: recordVersion(7) } })
  })

  it('carries every kind of change: locale, local accounts, residency', () => {
    const r = planTenantSettings({ ...draft, defaultLocale: 'en-GB', localAccountsEnabled: false, residencyMode: 'strict' }, current, true)
    expect(r).toEqual({ ok: true, value: { defaultLocale: 'en-GB', localAccountsEnabled: false, residencyMode: 'strict', recordVersion: recordVersion(7) } })
  })

  it('refuses a save with nothing changed', () => {
    expect(failure(planTenantSettings(draft, current, true))).toBe('no-change')
  })

  it('is the owner\'s alone', () => {
    expect(failure(planTenantSettings({ ...draft, name: 'New' }, current, false))).toBe('not-owner')
  })

  it('requires a name', () => {
    expect(failure(planTenantSettings({ ...draft, name: '  ' }, current, true))).toBe('name-required')
  })

  it.each([['en'], ['en-GB'], ['zh-Hant-TW'], ['ar']])('accepts the locale %s', (defaultLocale) => {
    expect(failure(planTenantSettings({ ...draft, defaultLocale, name: 'X' }, current, true))).toBe('ok')
  })

  it.each([[''], ['e'], ['english'], ['en_GB'], ['en-']])('refuses the locale %j', (defaultLocale) => {
    expect(failure(planTenantSettings({ ...draft, defaultLocale }, current, true))).toBe('locale-invalid')
  })

  it.each([[60, true], [900, true], [59, false], [901, false], [300.5, false], [Number.NaN, false]])('MFA window %s seconds → accepted: %s', (seconds, accepted) => {
    const r = planTenantSettings({ ...draft, mfaFreshnessSeconds: seconds, name: 'X' }, current, true)
    expect(failure(r) !== 'mfa-window-out-of-range').toBe(accepted)
  })

  it('refuses an unknown residency mode', () => {
    expect(failure(planTenantSettings({ ...draft, residencyMode: 'eu-only' }, current, true))).toBe('residency-invalid')
  })
})

describe('planDelegationPolicy (DLG-7)', () => {
  it.each([[1, 1], [180, 180], [90, 90]])('accepts %s and %s days', (maxDurationDays, reviewWindowDays) => {
    expect(planDelegationPolicy({ maxDurationDays, reviewWindowDays })).toEqual({ ok: true, value: { maxDurationDays, reviewWindowDays } })
  })

  it.each([[0], [181], [-5], [1.5], [Number.NaN]])('refuses %s days for the maximum, and names the field', (days) => {
    const r = planDelegationPolicy({ maxDurationDays: days, reviewWindowDays: 90 })
    expect(failure(r)).toBe('days-out-of-range')
    expect(at(r)).toBe('maxDurationDays')
  })

  it('refuses a review window out of range, and names that field', () => {
    const r = planDelegationPolicy({ maxDurationDays: 90, reviewWindowDays: 181 })
    expect(failure(r)).toBe('days-out-of-range')
    expect(at(r)).toBe('reviewWindowDays')
  })
})

describe('planAuditQuery (AL-1)', () => {
  it('takes one entry type per search (the SDK cannot repeat a query key), and says so', () => {
    const r = planAuditQuery({ entryTypes: ['auth.login', 'membership.added'] })
    expect(failure(r)).toBe('one-entry-type-only')
    expect(at(r)).toBe('entryTypes')
    expect(planAuditQuery({ entryTypes: ['auth.login'] }).ok).toBe(true)
    expect(planAuditQuery({ entryTypes: [] }).ok).toBe(true)
  })

  const filter = { entryTypes: ['auth.login'] }

  it('accepts a filter with a default page of 100', () => {
    expect(planAuditQuery(filter)).toEqual({ ok: true, value: { filter, limit: AUDIT_PAGE.default } })
  })

  it('carries a cursor and a page size, up to 1000', () => {
    const cursor = parseCursor('abc')!
    expect(planAuditQuery(filter, { limit: 1000, cursor })).toEqual({ ok: true, value: { filter, limit: 1000, cursor } })
  })

  it('refuses a page of more than 1000, or fewer than 1', () => {
    expect(failure(planAuditQuery(filter, { limit: 1001 }))).toBe('page-too-large')
    expect(failure(planAuditQuery(filter, { limit: 0 }))).toBe('page-too-small')
    expect(failure(planAuditQuery(filter, { limit: 2.5 }))).toBe('page-too-small')
  })

  it('refuses a range that ends before it starts, but not one that starts and ends together', () => {
    expect(failure(planAuditQuery({ entryTypes: [], from: '2026-11-02T00:00:00Z', to: '2026-11-01T00:00:00Z' }))).toBe('range-inverted')
    expect(planAuditQuery({ entryTypes: [], from: '2026-11-01T00:00:00Z', to: '2026-11-01T00:00:00Z' }).ok).toBe(true)
  })

  it('accepts a range with only one end, and refuses a date that is not a date', () => {
    expect(planAuditQuery({ entryTypes: [], from: '2026-11-01T00:00:00Z' }).ok).toBe(true)
    expect(planAuditQuery({ entryTypes: [], to: '2026-11-01T00:00:00Z' }).ok).toBe(true)
    expect(failure(planAuditQuery({ entryTypes: [], from: 'yesterday' }))).toBe('range-invalid')
    expect(failure(planAuditQuery({ entryTypes: [], to: 'tomorrow' }))).toBe('range-invalid')
  })
})
