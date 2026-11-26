import { describe, expect, it } from '@rstest/core'
import { adminKeys } from '../../../src/application/queries/keys'

describe('adminKeys', () => {
  it('starts every key with the workspace slug, so a workspace switch cannot show another workspace\'s data', () => {
    const keys = adminKeys('acme')
    const all = [
      keys.members({ limit: 50 }),
      keys.member('u-1'),
      keys.invitations(),
      keys.seatUsage(),
      keys.departments(),
      keys.departmentMembers('d-1'),
      keys.catalog(),
      keys.roleLabels(),
      keys.groupMappings('departments'),
      keys.settings(),
      keys.delegationPolicy(),
      keys.audit({ from: '2026-01-01' }),
      keys.auditEntry('a-1'),
      keys.auditExport('x-1'),
      keys.user('u-1'),
    ]
    for (const key of all) expect(key.slice(0, 2)).toEqual(['admin', 'acme'])
  })

  it('gives two workspaces disjoint keys', () => {
    expect(adminKeys('acme').members()).not.toEqual(adminKeys('globex').members())
  })

  it('keeps list params in the key, so each page and filter is its own entry', () => {
    const keys = adminKeys('acme')
    expect(keys.members({ limit: 50, cursor: 'a' })).not.toEqual(keys.members({ limit: 50, cursor: 'b' }))
    expect(keys.audit({ entry_type: 'auth.login' })).not.toEqual(keys.audit({ entry_type: 'membership.added' }))
  })

  it('invalidates by prefix: every list and detail of a resource shares its prefix', () => {
    const keys = adminKeys('acme')
    expect(keys.members().slice(0, 3)).toEqual(keys.member('u-1').slice(0, 3))
    expect(keys.all).toEqual(['admin', 'acme'])
  })

  it('stores one user profile per ID, shared by every screen', () => {
    expect(adminKeys('acme').user('u-1')).toEqual(['admin', 'acme', 'users', 'u-1'])
  })

  it('keeps unrelated resources off each other\'s prefix, so one write refetches only what it changed', () => {
    const keys = adminKeys('acme')
    const under = (parent: readonly unknown[], child: readonly unknown[]) => parent.every((part, i) => child[i] === part)
    // Retiring a department invalidates `departments`: not every row's member count.
    expect(under(keys.departments(), keys.departmentMembers('d-1'))).toBe(false)
    // Saving the workspace block invalidates `settings`: not the delegation policy.
    expect(under(keys.settings(), keys.delegationPolicy())).toBe(false)
    // A member write invalidates the `members` prefix and still reaches its list pages, owners and detail.
    expect(under(keys.members().slice(0, 3), keys.owners())).toBe(true)
  })
})
