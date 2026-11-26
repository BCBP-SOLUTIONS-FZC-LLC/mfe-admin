// What the admin area shows each kind of user. All hints: IAM and the gateway decide (LLD §8).
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from '@rstest/core'
import { useAdminAccess } from '../../../src/presentation/features/access/useAdminAccess'
import { ADMIN, MEMBER, OWNER, startPlatform } from '../../fixtures/platform'

function access(o: Parameters<typeof startPlatform>[0] = {}) {
  const platform = startPlatform(o)
  return renderHook(() => useAdminAccess(), { wrapper: platform.Wrapper }).result.current
}

describe('useAdminAccess', () => {
  it('lets an owner open every section and manage everything', () => {
    const a = access({ permissions: OWNER })
    expect(a.sections).toEqual({ users: true, departments: true, groupMappings: true, settings: true, audit: true })
    expect(a).toMatchObject({
      canReadMembers: true,
      canManageMembers: true,
      canManageAdminRoles: true,
      canManageTenantSettings: true,
      canManageDelegationPolicy: true,
      canManageSso: true,
      canReadAudit: true,
      readOnly: false,
    })
  })

  it('lets an admin manage members, delegation policy, SSO and audit, but not owner-only blocks', () => {
    const a = access({ permissions: ADMIN })
    expect(a.sections).toEqual({ users: true, departments: true, groupMappings: true, settings: true, audit: true })
    expect(a.canManageAdminRoles).toBe(false)
    expect(a.canManageTenantSettings).toBe(false)
    expect(a.canManageDelegationPolicy).toBe(true)
  })

  it('lets a plain member read the member list and departments, and nothing else', () => {
    const a = access({ permissions: MEMBER })
    expect(a.sections).toEqual({ users: true, departments: true, groupMappings: false, settings: false, audit: false })
    expect(a.canReadMembers).toBe(true)
    expect(a.canManageMembers).toBe(false)
    expect(a.canReadAudit).toBe(false)
  })

  it('treats manage:members as implying the right to view members', () => {
    const a = access({ permissions: ['manage:members'] })
    expect(a.canReadMembers).toBe(true)
    expect(a.sections.users).toBe(true)
  })

  it('opens nothing for a user with no permission (deny all, as before the session context loads)', () => {
    const a = access({ permissions: [] })
    expect(Object.values(a.sections).every((open) => !open)).toBe(true)
  })

  it('opens the settings section for an owner-only or a delegation-only user', () => {
    expect(access({ permissions: ['manage:tenant-settings'] }).sections.settings).toBe(true)
    expect(access({ permissions: ['manage:delegation-policy'] }).sections.settings).toBe(true)
  })

  it('disables every mutation in a read-only workspace but keeps the sections open', () => {
    const a = access({ permissions: OWNER, context: { readOnly: true } })
    expect(a.readOnly).toBe(true)
    expect(a).toMatchObject({
      canManageMembers: false,
      canManageAdminRoles: false,
      canManageTenantSettings: false,
      canManageDelegationPolicy: false,
    })
    expect(a.canReadMembers).toBe(true)
    expect(a.sections.audit).toBe(true)
  })
})
